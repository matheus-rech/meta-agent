/**
 * Sandbox Tools
 * Interface for Docker-based R/Python execution environment
 */

import { MCPClient } from '../mcp/client.js';
import { spawn, execSync, ChildProcess } from 'child_process';

const DOCKER_IMAGE = 'neuroresearch/sandbox:latest';
const CONTAINER_NAME = 'nra-sandbox';

export class SandboxTools {
  private mcp: MCPClient;
  private container: ChildProcess | null = null;
  private workDir: string;
  
  constructor(mcp: MCPClient, workDir?: string) {
    this.mcp = mcp;
    this.workDir = workDir || process.cwd();
  }
  
  /**
   * Start the Docker sandbox container
   */
  async start(): Promise<void> {
    // Check if container exists
    try {
      execSync(`docker inspect ${CONTAINER_NAME}`, { stdio: 'pipe' });
      
      // Check if running
      const status = execSync(
        `docker inspect -f '{{.State.Running}}' ${CONTAINER_NAME}`,
        { encoding: 'utf-8' }
      ).trim();
      
      if (status !== 'true') {
        execSync(`docker start ${CONTAINER_NAME}`, { stdio: 'pipe' });
      }
      
      console.error('Sandbox container started');
      return;
      
    } catch {
      // Container doesn't exist
    }
    
    // Check if image exists, pull if not
    try {
      execSync(`docker inspect ${DOCKER_IMAGE}`, { stdio: 'pipe' });
    } catch {
      console.error('Pulling sandbox image...');
      execSync(`docker pull ${DOCKER_IMAGE}`, { stdio: 'inherit' });
    }
    
    // Create and start container
    execSync(
      `docker run -d --name ${CONTAINER_NAME} -v "${this.workDir}:/workspace" ${DOCKER_IMAGE} tail -f /dev/null`,
      { stdio: 'pipe' }
    );
    
    console.error('Sandbox container created and started');
  }
  
  /**
   * Stop the Docker sandbox container
   */
  async stop(): Promise<void> {
    try {
      execSync(`docker stop ${CONTAINER_NAME}`, { stdio: 'pipe' });
      console.error('Sandbox container stopped');
    } catch (error) {
      // Container might not exist
    }
  }
  
  /**
   * Remove the Docker sandbox container
   */
  async destroy(): Promise<void> {
    try {
      execSync(`docker rm -f ${CONTAINER_NAME}`, { stdio: 'pipe' });
      console.error('Sandbox container removed');
    } catch (error) {
      // Container might not exist
    }
  }
  
  /**
   * Execute a command in the sandbox
   */
  async execute(command: string): Promise<string> {
    await this.ensureRunning();
    
    const escapedCommand = command.replace(/"/g, '\\"');
    const result = execSync(
      `docker exec ${CONTAINER_NAME} bash -c "${escapedCommand}"`,
      {
        encoding: 'utf-8',
        cwd: this.workDir,
        maxBuffer: 50 * 1024 * 1024, // 50MB
      }
    );
    
    return result;
  }
  
  /**
   * Execute R code in the sandbox
   */
  async executeR(code: string): Promise<string> {
    // Write code to temp file and execute
    const tempScript = `/tmp/script_${Date.now()}.R`;
    await this.execute(`cat > ${tempScript} << 'RSCRIPT'\n${code}\nRSCRIPT`);
    
    try {
      const result = await this.execute(`cd /workspace && Rscript ${tempScript} 2>&1`);
      return result;
    } finally {
      await this.execute(`rm -f ${tempScript}`).catch(() => {});
    }
  }
  
  /**
   * Execute Python code in the sandbox
   */
  async executePython(code: string): Promise<string> {
    const tempScript = `/tmp/script_${Date.now()}.py`;
    await this.execute(`cat > ${tempScript} << 'PYSCRIPT'\n${code}\nPYSCRIPT`);
    
    try {
      const result = await this.execute(`cd /workspace && python3 ${tempScript} 2>&1`);
      return result;
    } finally {
      await this.execute(`rm -f ${tempScript}`).catch(() => {});
    }
  }
  
  /**
   * Open interactive R session
   */
  async interactiveR(): Promise<void> {
    await this.ensureRunning();
    
    const proc = spawn('docker', ['exec', '-it', CONTAINER_NAME, 'R'], {
      stdio: 'inherit',
    });
    
    await new Promise<void>((resolve) => {
      proc.on('close', () => resolve());
    });
  }
  
  /**
   * Open interactive Python session
   */
  async interactivePython(): Promise<void> {
    await this.ensureRunning();
    
    const proc = spawn('docker', ['exec', '-it', CONTAINER_NAME, 'python3'], {
      stdio: 'inherit',
    });
    
    await new Promise<void>((resolve) => {
      proc.on('close', () => resolve());
    });
  }
  
  /**
   * Copy file to container
   */
  async copyToContainer(localPath: string, containerPath: string): Promise<void> {
    execSync(`docker cp "${localPath}" ${CONTAINER_NAME}:${containerPath}`, {
      stdio: 'pipe',
    });
  }
  
  /**
   * Copy file from container
   */
  async copyFromContainer(containerPath: string, localPath: string): Promise<void> {
    execSync(`docker cp ${CONTAINER_NAME}:${containerPath} "${localPath}"`, {
      stdio: 'pipe',
    });
  }
  
  /**
   * Start Shiny app
   */
  async startShiny(port: number = 3838): Promise<void> {
    await this.ensureRunning();
    
    // Check if port is already in use
    try {
      execSync(`lsof -i:${port}`, { stdio: 'pipe' });
      console.error(`Port ${port} already in use`);
      return;
    } catch {
      // Port is available
    }
    
    // Start Shiny in background
    const shinyCode = `
library(shiny)
library(meta)

ui <- fluidPage(
  titlePanel("NeuroResearch Meta-Analysis Dashboard"),
  sidebarLayout(
    sidebarPanel(
      fileInput("data", "Upload CSV Data"),
      selectInput("outcome_type", "Outcome Type", 
                  choices = c("Binary", "Continuous", "Proportion")),
      selectInput("measure", "Effect Measure",
                  choices = c("OR", "RR", "MD", "SMD")),
      actionButton("analyze", "Run Analysis")
    ),
    mainPanel(
      tabsetPanel(
        tabPanel("Forest Plot", plotOutput("forest")),
        tabPanel("Funnel Plot", plotOutput("funnel")),
        tabPanel("Summary", verbatimTextOutput("summary"))
      )
    )
  )
)

server <- function(input, output, session) {
  # Placeholder server logic
  output$summary <- renderText("Upload data to begin analysis")
}

shinyApp(ui, server, options = list(port = ${port}, host = "0.0.0.0"))
`;
    
    await this.execute(`cat > /tmp/shiny_app.R << 'SHINY'\n${shinyCode}\nSHINY`);
    
    // Run in background
    spawn('docker', [
      'exec', '-d', CONTAINER_NAME,
      'Rscript', '/tmp/shiny_app.R',
    ], { stdio: 'pipe' });
    
    console.error(`Shiny dashboard starting on port ${port}...`);
  }
  
  /**
   * Get container status
   */
  async getStatus(): Promise<{
    running: boolean;
    image: string;
    created: string;
    workDir: string;
  }> {
    try {
      const inspect = execSync(
        `docker inspect ${CONTAINER_NAME}`,
        { encoding: 'utf-8' }
      );
      const data = JSON.parse(inspect)[0];
      
      return {
        running: data.State.Running,
        image: data.Config.Image,
        created: data.Created,
        workDir: this.workDir,
      };
    } catch {
      return {
        running: false,
        image: DOCKER_IMAGE,
        created: '',
        workDir: this.workDir,
      };
    }
  }
  
  /**
   * Ensure container is running
   */
  private async ensureRunning(): Promise<void> {
    const status = await this.getStatus();
    if (!status.running) {
      await this.start();
    }
  }
  
  /**
   * List installed R packages
   */
  async listRPackages(): Promise<string[]> {
    const result = await this.executeR('cat(rownames(installed.packages()), sep = "\\n")');
    return result.trim().split('\n');
  }
  
  /**
   * Install R packages
   */
  async installRPackages(packages: string[]): Promise<string> {
    const packagesStr = packages.map(p => `"${p}"`).join(', ');
    return this.executeR(
      `install.packages(c(${packagesStr}), repos="https://cloud.r-project.org")`
    );
  }
  
  /**
   * Check if R package is installed
   */
  async hasRPackage(packageName: string): Promise<boolean> {
    const result = await this.executeR(
      `cat(require("${packageName}", quietly = TRUE))`
    );
    return result.trim() === 'TRUE';
  }
}

export default SandboxTools;
