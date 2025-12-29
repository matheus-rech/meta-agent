"""Project scaffolding and management for Meta CLI."""

import json
from datetime import datetime
from pathlib import Path
from typing import Any

import yaml
from rich.console import Console
from rich.progress import Progress, SpinnerColumn, TextColumn

from .banner import print_success, print_info, print_error
from .config import save_project_config, DEFAULT_CONFIG


# Project directory structure
PROJECT_DIRS = [
    ".meta",
    "protocol",
    "searches",
    "searches/results",
    "screening",
    "screening/fulltext",
    "extractions",
    "extractions/studies",
    "quality",
    "quality/grade",
    "analysis",
    "analysis/scripts",
    "analysis/results",
    "figures",
    "tables",
    "manuscript",
    "supplementary",
]


def slugify(title: str) -> str:
    """Convert title to valid directory name."""
    import re
    # Remove special characters, replace spaces with hyphens
    slug = re.sub(r'[^\w\s-]', '', title.lower())
    slug = re.sub(r'[\s_]+', '-', slug)
    slug = re.sub(r'-+', '-', slug).strip('-')
    return slug[:50]  # Limit length


def init_project(
    title: str,
    parent_dir: Path | None = None,
    console: Console | None = None
) -> Path:
    """
    Initialize a new systematic review project.

    Args:
        title: Project title (e.g., "DBS for Parkinson's disease")
        parent_dir: Directory to create project in. Defaults to cwd.
        console: Rich console for output.

    Returns:
        Path to created project directory.
    """
    if console is None:
        console = Console()

    if parent_dir is None:
        parent_dir = Path.cwd()

    # Create project directory
    project_slug = slugify(title)
    project_dir = parent_dir / project_slug

    if project_dir.exists():
        print_error(f"Directory already exists: {project_dir}", console)
        raise FileExistsError(f"Directory already exists: {project_dir}")

    with Progress(
        SpinnerColumn(),
        TextColumn("[progress.description]{task.description}"),
        console=console,
        transient=True
    ) as progress:
        task = progress.add_task("Creating project structure...", total=None)

        # Create directories
        for dir_name in PROJECT_DIRS:
            (project_dir / dir_name).mkdir(parents=True, exist_ok=True)

        progress.update(task, description="Initializing configuration...")

        # Create project config
        project_config = {
            "project": {
                "title": title,
                "slug": project_slug,
                "created": datetime.now().isoformat(),
                "phase": "protocol",
            },
            **DEFAULT_CONFIG
        }
        save_project_config(project_config, project_dir)

        progress.update(task, description="Creating state files...")

        # Create state file
        state = {
            "phase": "protocol",
            "created": datetime.now().isoformat(),
            "updated": datetime.now().isoformat(),
            "searches": [],
            "screening": {
                "total": 0,
                "included": 0,
                "excluded": 0,
                "pending": 0,
            },
            "extractions": [],
            "analyses": [],
        }
        with open(project_dir / ".meta" / "state.json", "w") as f:
            json.dump(state, f, indent=2)

        # Create empty memory file
        with open(project_dir / ".meta" / "memory.json", "w") as f:
            json.dump({"conversations": []}, f, indent=2)

        progress.update(task, description="Generating templates...")

        # Create protocol template
        _create_protocol_template(project_dir, title)

        # Create extraction template
        _create_extraction_template(project_dir)

        # Create README
        _create_readme(project_dir, title)

    print_success(f"Created project: {project_dir}", console)
    print_info("Next steps:", console)
    console.print("  1. cd " + str(project_dir))
    console.print("  2. meta  (start interactive session)")
    console.print("  3. Define your PICO and eligibility criteria")
    console.print()

    return project_dir


def _create_protocol_template(project_dir: Path, title: str) -> None:
    """Create protocol template."""
    protocol = f"""# {title}

## Systematic Review Protocol

### Registration
- PROSPERO ID: (pending)
- Protocol DOI: (pending)

---

## Research Question

### PICO Framework

**Population:**
- [ ] Define target population
- [ ] Age criteria
- [ ] Clinical criteria

**Intervention:**
- [ ] Define intervention(s)
- [ ] Comparators

**Comparator:**
- [ ] Standard care
- [ ] Alternative interventions
- [ ] Placebo/sham

**Outcomes:**

*Primary:*
1. [ ] Primary outcome 1
2. [ ] Primary outcome 2

*Secondary:*
1. [ ] Secondary outcome 1
2. [ ] Secondary outcome 2

### Timepoint
- [ ] Define follow-up timepoint(s)

---

## Eligibility Criteria

### Inclusion
- [ ] Study designs to include
- [ ] Language restrictions
- [ ] Publication date range

### Exclusion
- [ ] Case reports
- [ ] Reviews/editorials
- [ ] Animal studies
- [ ] Insufficient data

---

## Information Sources

### Databases
- [ ] PubMed/MEDLINE
- [ ] Embase
- [ ] Cochrane CENTRAL
- [ ] Web of Science

### Other Sources
- [ ] Trial registries (ClinicalTrials.gov)
- [ ] Conference abstracts
- [ ] Reference list searching
- [ ] Expert consultation

---

## Search Strategy

(To be developed with Meta's assistance)

---

## Study Selection

### Process
1. Title/abstract screening (2 reviewers)
2. Full-text review (2 reviewers)
3. Disagreement resolution

### Tools
- Screening: Meta CLI
- Reference management: (specify)

---

## Data Extraction

### Items
- Study characteristics
- Patient demographics
- Intervention details
- Outcomes (events, means, effect estimates)

### Process
- Piloted extraction form
- Double extraction for subset
- Author contact for missing data

---

## Risk of Bias Assessment

### Tools
- RCTs: Cochrane RoB 2
- Cohort studies: Newcastle-Ottawa Scale
- Non-randomized interventions: ROBINS-I

---

## Data Synthesis

### Meta-analysis
- Software: R (meta package)
- Effect measures: OR/RR for binary, MD/SMD for continuous
- Model: Random-effects (DerSimonian-Laird)
- Heterogeneity: I², τ², prediction interval

### Subgroup Analyses
- [ ] Planned subgroup 1
- [ ] Planned subgroup 2

### Sensitivity Analyses
- [ ] Exclude high RoB studies
- [ ] Leave-one-out analysis

### Publication Bias
- Funnel plot (if ≥10 studies)
- Egger's test

---

## Certainty of Evidence

GRADE assessment for each outcome

---

## Timeline

| Phase | Target Date |
|-------|-------------|
| Protocol registration | |
| Search completion | |
| Screening completion | |
| Data extraction | |
| Analysis | |
| Manuscript draft | |

---

## Team

| Role | Name |
|------|------|
| Lead author | |
| Co-authors | |
| Statistician | |
| Information specialist | |

---

*Protocol created: {datetime.now().strftime('%Y-%m-%d')}*
*Last updated: {datetime.now().strftime('%Y-%m-%d')}*
"""

    with open(project_dir / "protocol" / "protocol.md", "w") as f:
        f.write(protocol)


def _create_extraction_template(project_dir: Path) -> None:
    """Create data extraction template."""
    template = {
        "study_id": "",
        "pmid": "",
        "doi": "",
        "first_author": "",
        "year": None,
        "country": "",
        "study_design": "",
        "multicenter": False,
        "study_period": "",
        "sample_size": None,
        "population": {
            "description": "",
            "inclusion_criteria": "",
            "age_mean": None,
            "age_sd": None,
            "male_percent": None,
        },
        "intervention": {
            "name": "",
            "type": "",
            "details": "",
            "n": None,
        },
        "control": {
            "name": "",
            "type": "",
            "details": "",
            "n": None,
        },
        "outcomes": [],
        "follow_up": "",
        "funding": "",
        "conflicts": "",
        "notes": "",
    }

    with open(project_dir / "extractions" / "template.yaml", "w") as f:
        yaml.dump(template, f, default_flow_style=False, sort_keys=False)


def _create_readme(project_dir: Path, title: str) -> None:
    """Create project README."""
    readme = f"""# {title}

A systematic review and meta-analysis project managed with Meta CLI.

## Project Structure

```
.
├── .meta/              # Meta configuration and state
├── protocol/           # Study protocol and registration
├── searches/           # Search strategies and results
├── screening/          # Screening decisions and full-texts
├── extractions/        # Data extraction files
├── quality/            # Risk of bias assessments
├── analysis/           # R scripts and analysis outputs
├── figures/            # Generated figures
├── tables/             # Generated tables
├── manuscript/         # Manuscript sections
└── supplementary/      # Supplementary materials
```

## Quick Start

```bash
# Enter project directory
cd {project_dir.name}

# Start Meta
meta

# Or run specific commands
meta search "your query"
meta analyze mortality
meta write methods
```

## Workflow

1. **Protocol** - Define PICO, eligibility, search strategy
2. **Search** - Execute searches across databases
3. **Screening** - Title/abstract and full-text screening
4. **Extraction** - Extract data from included studies
5. **Quality** - Assess risk of bias
6. **Analysis** - Run meta-analyses
7. **Writing** - Draft manuscript sections

## Status

- Phase: Protocol
- Studies found: 0
- Studies included: 0

---

*Created: {datetime.now().strftime('%Y-%m-%d')}*
"""

    with open(project_dir / "README.md", "w") as f:
        f.write(readme)


def get_project_state(project_dir: Path | None = None) -> dict[str, Any]:
    """Get current project state."""
    if project_dir is None:
        project_dir = Path.cwd()

    state_path = project_dir / ".meta" / "state.json"

    if not state_path.exists():
        return {}

    with open(state_path) as f:
        return json.load(f)


def update_project_state(updates: dict[str, Any], project_dir: Path | None = None) -> None:
    """Update project state."""
    if project_dir is None:
        project_dir = Path.cwd()

    state_path = project_dir / ".meta" / "state.json"
    state = get_project_state(project_dir)
    state.update(updates)
    state["updated"] = datetime.now().isoformat()

    with open(state_path, "w") as f:
        json.dump(state, f, indent=2)


def is_meta_project(path: Path | None = None) -> bool:
    """Check if path is a Meta project directory."""
    if path is None:
        path = Path.cwd()
    return (path / ".meta" / "config.yaml").exists()


def get_project_title(project_dir: Path | None = None) -> str:
    """Get project title from config."""
    if project_dir is None:
        project_dir = Path.cwd()

    config_path = project_dir / ".meta" / "config.yaml"

    if not config_path.exists():
        return ""

    with open(config_path) as f:
        config = yaml.safe_load(f) or {}

    return config.get("project", {}).get("title", "")


def get_project_phase(project_dir: Path | None = None) -> str:
    """Get current project phase."""
    state = get_project_state(project_dir)
    return state.get("phase", "unknown")
