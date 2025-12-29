/**
 * R Execution Tools
 * High-level interface for R-based statistical analysis
 */

import { MCPClient } from '../mcp/client.js';

export interface MetaAnalysisParams {
  input: string;
  outcome?: string;
  type: 'binary' | 'continuous' | 'proportion' | 'survival';
  measure?: 'OR' | 'RR' | 'RD' | 'MD' | 'SMD' | 'HR';
  columns?: {
    study?: string;
    year?: string;
    events_int?: string;
    n_int?: string;
    events_ctrl?: string;
    n_ctrl?: string;
    mean_int?: string;
    sd_int?: string;
    mean_ctrl?: string;
    sd_ctrl?: string;
    events?: string;
    total?: string;
  };
  outputDir?: string;
}

export interface MetaAnalysisResult {
  k: number;
  estimate: number;
  ci_lower: number;
  ci_upper: number;
  p_value: number;
  i2: number;
  tau2: number;
  prediction_lower?: number;
  prediction_upper?: number;
  files: string[];
  output: string;
}

export interface ForestPlotParams {
  input: string;
  output?: string;
  width?: number;
  height?: number;
  sortBy?: 'effect' | 'year' | 'weight' | 'alphabetical';
  showPrediction?: boolean;
}

export interface PRISMAParams {
  identified: number;
  duplicates?: number;
  screened: number;
  excludedScreening?: number;
  eligible: number;
  included: number;
  output?: string;
}

export interface SubgroupParams {
  input: string;
  subgroup: string;
  output?: string;
}

export class RTools {
  private mcp: MCPClient;
  
  constructor(mcp: MCPClient) {
    this.mcp = mcp;
  }
  
  /**
   * Execute arbitrary R code
   */
  async execute(code: string): Promise<string> {
    return this.mcp.callTool('r_execute', { code });
  }
  
  /**
   * Run a complete meta-analysis
   */
  async runMetaAnalysis(params: MetaAnalysisParams): Promise<MetaAnalysisResult> {
    return this.mcp.callTool('r_meta_analysis', {
      input: params.input,
      type: params.type,
      measure: params.measure || this.getDefaultMeasure(params.type),
      columns: params.columns || {},
      outputDir: params.outputDir || './results',
    });
  }
  
  /**
   * Get default effect measure for outcome type
   */
  private getDefaultMeasure(type: string): string {
    switch (type) {
      case 'binary': return 'OR';
      case 'continuous': return 'MD';
      case 'proportion': return 'PLOGIT';
      case 'survival': return 'HR';
      default: return 'OR';
    }
  }
  
  /**
   * Generate forest plot
   */
  async generateForestPlot(params: ForestPlotParams): Promise<{ file: string }> {
    return this.mcp.callTool('r_forest_plot', {
      input: params.input,
      output: params.output || 'figures/forest_plot.png',
      width: params.width || 1200,
      height: params.height || 800,
    });
  }
  
  /**
   * Generate funnel plot
   */
  async generateFunnelPlot(params: { input: string; output?: string }): Promise<{ file: string }> {
    return this.mcp.callTool('r_funnel_plot', {
      input: params.input,
      output: params.output || 'figures/funnel_plot.png',
    });
  }
  
  /**
   * Generate PRISMA flow diagram
   */
  async generatePRISMA(params: PRISMAParams): Promise<{ file: string }> {
    return this.mcp.callTool('r_prisma', {
      identified: params.identified,
      duplicates: params.duplicates || 0,
      screened: params.screened,
      excludedScreening: params.excludedScreening,
      eligible: params.eligible,
      included: params.included,
      output: params.output || 'figures/prisma_flow.png',
    });
  }
  
  /**
   * Generate risk of bias plot
   */
  async generateRoBPlot(params: {
    input: string;
    tool: 'ROB2' | 'ROBINS-I' | 'NOS' | 'QUADAS-2';
    output?: string;
  }): Promise<{ file: string }> {
    return this.mcp.callTool('r_rob_plot', {
      input: params.input,
      tool: params.tool,
      output: params.output || 'figures/rob_traffic_light.png',
    });
  }
  
  /**
   * Run subgroup analysis
   */
  async runSubgroupAnalysis(params: SubgroupParams): Promise<{
    file: string;
    testResults: string;
    output: string;
  }> {
    return this.mcp.callTool('r_subgroup', {
      input: params.input,
      subgroup: params.subgroup,
      output: params.output || 'figures/subgroup_forest.png',
    });
  }
  
  /**
   * Install R packages
   */
  async installPackages(packages: string[]): Promise<string> {
    return this.mcp.callTool('r_install_packages', { packages });
  }
  
  /**
   * Run leave-one-out sensitivity analysis
   */
  async runLeaveOneOut(params: { input: string; output?: string }): Promise<{ file: string }> {
    const code = `
library(meta)
data <- read.csv("${params.input}")
if ("events_int" %in% names(data)) {
  ma <- metabin(event.e = events_int, n.e = n_int,
                event.c = events_ctrl, n.c = n_ctrl,
                studlab = study, data = data, random = TRUE)
} else {
  ma <- metacont(n.e = n_int, mean.e = mean_int, sd.e = sd_int,
                 n.c = n_ctrl, mean.c = mean_ctrl, sd.c = sd_ctrl,
                 studlab = study, data = data, random = TRUE)
}
l1o <- metainf(ma, pooled = "random")
png("${params.output || 'figures/leave_one_out.png'}", width = 1000, height = 600, res = 150)
forest(l1o)
dev.off()
`;
    await this.execute(code);
    return { file: params.output || 'figures/leave_one_out.png' };
  }
  
  /**
   * Run cumulative meta-analysis
   */
  async runCumulativeAnalysis(params: { input: string; output?: string }): Promise<{ file: string }> {
    const code = `
library(meta)
data <- read.csv("${params.input}")
if ("events_int" %in% names(data)) {
  ma <- metabin(event.e = events_int, n.e = n_int,
                event.c = events_ctrl, n.c = n_ctrl,
                studlab = study, data = data, random = TRUE)
} else {
  ma <- metacont(n.e = n_int, mean.e = mean_int, sd.e = sd_int,
                 n.c = n_ctrl, mean.c = mean_ctrl, sd.c = sd_ctrl,
                 studlab = study, data = data, random = TRUE)
}
cum <- metacum(ma, sortvar = data$year)
png("${params.output || 'figures/cumulative.png'}", width = 1000, height = 600, res = 150)
forest(cum)
dev.off()
`;
    await this.execute(code);
    return { file: params.output || 'figures/cumulative.png' };
  }
  
  /**
   * Interpret heterogeneity statistics
   */
  interpretHeterogeneity(i2: number): {
    level: string;
    interpretation: string;
    recommendation: string;
  } {
    if (i2 < 0.25) {
      return {
        level: 'Low',
        interpretation: 'The studies are fairly consistent.',
        recommendation: 'Fixed or random effects model appropriate.',
      };
    } else if (i2 < 0.5) {
      return {
        level: 'Moderate',
        interpretation: 'Some variability between studies.',
        recommendation: 'Consider exploring sources of heterogeneity.',
      };
    } else if (i2 < 0.75) {
      return {
        level: 'Substantial',
        interpretation: 'Considerable variability between studies.',
        recommendation: 'Explore heterogeneity through subgroup or meta-regression.',
      };
    } else {
      return {
        level: 'Considerable',
        interpretation: 'Very high variability; results may not be poolable.',
        recommendation: 'Consider narrative synthesis or finding sources of heterogeneity.',
      };
    }
  }
  
  /**
   * Format meta-analysis results for display
   */
  formatResults(result: MetaAnalysisResult, type: 'binary' | 'continuous' | 'proportion'): string {
    let output = `\n${'='.repeat(60)}\n`;
    output += `META-ANALYSIS RESULTS\n`;
    output += `${'='.repeat(60)}\n\n`;
    
    output += `Studies included: ${result.k}\n\n`;
    
    if (type === 'proportion') {
      output += `Pooled proportion: ${(result.estimate * 100).toFixed(1)}%\n`;
      output += `95% CI: [${(result.ci_lower * 100).toFixed(1)}%, ${(result.ci_upper * 100).toFixed(1)}%]\n`;
    } else {
      output += `Pooled effect: ${result.estimate.toFixed(2)}\n`;
      output += `95% CI: [${result.ci_lower.toFixed(2)}, ${result.ci_upper.toFixed(2)}]\n`;
    }
    
    output += `P-value: ${result.p_value < 0.0001 ? '< 0.0001' : result.p_value.toFixed(4)}\n\n`;
    
    output += `HETEROGENEITY\n`;
    output += `-`.repeat(40) + '\n';
    output += `I² = ${(result.i2 * 100).toFixed(1)}%\n`;
    output += `τ² = ${result.tau2.toFixed(4)}\n`;
    
    if (result.prediction_lower && result.prediction_upper) {
      output += `Prediction interval: [${result.prediction_lower.toFixed(2)}, ${result.prediction_upper.toFixed(2)}]\n`;
    }
    
    const hetInterp = this.interpretHeterogeneity(result.i2);
    output += `\nInterpretation: ${hetInterp.level} heterogeneity\n`;
    output += `${hetInterp.recommendation}\n`;
    
    output += `\nFILES GENERATED\n`;
    output += `-`.repeat(40) + '\n';
    for (const file of result.files) {
      output += `  • ${file}\n`;
    }
    
    return output;
  }
}

export default RTools;
