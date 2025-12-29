# Code for Neurosurgery Research

## Comprehensive Workflow Guide

A complete system for systematic reviews, meta-analyses, and research automation in neurosurgery using Claude Code, R, and Python.

-----

## Table of Contents

1. [Running R in Claude Code](#running-r-in-claude-code)
2. [Environment Setup Options](#environment-setup-options)
3. [Claude Skills for Neurosurgery](#claude-skills-for-neurosurgery)
4. [Slash Commands Library](#slash-commands-library)
5. [Systematic Review Workflow](#systematic-review-workflow)
6. [Meta-Analysis Templates](#meta-analysis-templates)
7. [Shiny Dashboard Builder](#shiny-dashboard-builder)
8. [Research Paper Writing](#research-paper-writing)
9. [Advanced Topics](#advanced-topics)
10. [Quick Reference](#quick-reference)

-----

## Running R in Claude Code

### Yes, You Can Run R Directly!

**You do NOT need RStudio or VS Code's R extension.** Claude Code can execute R directly from the terminal in three ways:

### Method 1: Inline R Execution (Recommended)

Claude Code can write and run R code in a single command:

```bash
# In Claude Code terminal, just ask:
> Run a meta-analysis on my data in extractions.csv using metafor

# Claude will:
# 1. Write the R script
# 2. Execute it with Rscript
# 3. Show you the output
# 4. Save plots to files
```

### Method 2: Script Execution

```bash
# Claude writes script
> Create an R script to generate a forest plot from my data

# Then executes it
Rscript scripts/forest_plot.R
```

### Method 3: Interactive R Session

```bash
# Start interactive R
R

# Run commands
> library(meta)
> data <- read.csv("extractions.csv")
> ma <- metabin(events.e, n.e, events.c, n.c, data=data, studlab=study)
> forest(ma)
> q()  # quit
```

### Method 4: One-liner Execution

```bash
# Quick calculations
R -e 'library(meta); print(sqrt(0.5))'

# Run script silently
R -q -f script.R

# Run with arguments
Rscript script.R --input data.csv --output results/
```

### Viewing Plots

When running R from terminal (not RStudio), plots save to files:

```r
# PNG output
png("figures/forest_plot.png", width=1200, height=800, res=150)
forest(ma)
dev.off()

# PDF output (better for publications)
pdf("figures/forest_plot.pdf", width=10, height=8)
forest(ma)
dev.off()

# SVG for web
svg("figures/forest_plot.svg", width=10, height=8)
forest(ma)
dev.off()
```

Claude Code will automatically save plots and show you the file path.

-----

## Environment Setup Options

### Option A: Claude Code with Local R Installation (Simplest)

If you have R installed on your system:

```bash
# Mac: Install R via Homebrew
brew install r

# Install required packages once
R -e 'install.packages(c("meta", "metafor", "dmetar", "forestplot", "robvis", "tidyverse"))'

# Then just use Claude Code
cd ~/Documents/my-research
claude
```

### Option B: Docker Container (Reproducible)

For reproducible environments across machines:

#### Dockerfile

```dockerfile
# .devcontainer/Dockerfile
FROM rocker/shiny-verse:latest

# System dependencies
RUN apt-get update && apt-get install -y \
    libcurl4-openssl-dev \
    libssl-dev \
    libxml2-dev \
    libpoppler-cpp-dev \
    libmagick++-dev \
    tesseract-ocr \
    libtesseract-dev \
    libleptonica-dev \
    pandoc \
    git curl \
    && rm -rf /var/lib/apt/lists/*

# ============================================
# NEUROSURGERY RESEARCH R PACKAGES
# ============================================

# Meta-analysis core
RUN R -q -e 'install.packages(c(
  "meta",
  "metafor",
  "dmetar",
  "metasens",
  "netmeta",
  "gemtc",
  "dosresmeta",
  "metaBMA"
), repos="https://cloud.r-project.org")'

# Effect size calculations
RUN R -q -e 'install.packages(c(
  "esc",
  "compute.es",
  "effectsize",
  "MBESS"
), repos="https://cloud.r-project.org")'

# Risk of bias & quality
RUN R -q -e 'install.packages(c(
  "robvis",
  "revtools"
), repos="https://cloud.r-project.org")'

# PRISMA & reporting
RUN R -q -e 'install.packages(c(
  "PRISMAstatement",
  "metagear",
  "PRISMA2020"
), repos="https://cloud.r-project.org")'

# Survival & time-to-event
RUN R -q -e 'install.packages(c(
  "survival",
  "survminer",
  "IPDfromKM",
  "survRM2",
  "flexsurv"
), repos="https://cloud.r-project.org")'

# Visualization
RUN R -q -e 'install.packages(c(
  "forestplot",
  "forestploter",
  "ggplot2",
  "ggforestplot",
  "gridExtra",
  "patchwork",
  "cowplot",
  "scales",
  "viridis",
  "RColorBrewer"
), repos="https://cloud.r-project.org")'

# Data manipulation
RUN R -q -e 'install.packages(c(
  "tidyverse",
  "data.table",
  "janitor",
  "lubridate",
  "stringr",
  "forcats"
), repos="https://cloud.r-project.org")'

# File I/O
RUN R -q -e 'install.packages(c(
  "readxl",
  "writexl",
  "openxlsx",
  "pdftools",
  "officer",
  "rio"
), repos="https://cloud.r-project.org")'

# Tables & reporting
RUN R -q -e 'install.packages(c(
  "gtsummary",
  "flextable",
  "kableExtra",
  "gt",
  "huxtable",
  "tableone"
), repos="https://cloud.r-project.org")'

# Statistical helpers
RUN R -q -e 'install.packages(c(
  "broom",
  "parameters",
  "performance",
  "see",
  "report"
), repos="https://cloud.r-project.org")'

# Shiny
RUN R -q -e 'install.packages(c(
  "shiny",
  "shinydashboard",
  "shinyWidgets",
  "DT",
  "plotly",
  "shinyjs"
), repos="https://cloud.r-project.org")'

# ============================================
# PYTHON FOR PDF PROCESSING
# ============================================
RUN apt-get update && apt-get install -y python3 python3-pip
RUN pip3 install --break-system-packages \
    PyPDF2 \
    pdfplumber \
    tabula-py \
    camelot-py[cv] \
    pandas \
    openpyxl

# ============================================
# CLAUDE CODE
# ============================================
RUN curl -fsSL https://deb.nodesource.com/setup_lts.x | bash - \
    && apt-get install -y nodejs \
    && npm install -g npm@latest \
    && npm install -g @anthropic-ai/claude-code

# VS Code R support
RUN R -q -e 'install.packages(c("rstudioapi", "languageserver", "httpgd"), repos="https://cloud.r-project.org")'

EXPOSE 3838
WORKDIR /workspaces
```

#### devcontainer.json

```json
{
  "name": "Neurosurgery Research",
  "build": {
    "dockerfile": "Dockerfile"
  },
  "customizations": {
    "vscode": {
      "extensions": [
        "REditorSupport.r",
        "Posit.shiny",
        "ms-python.python",
        "GitHub.copilot",
        "yzhang.markdown-all-in-one"
      ],
      "settings": {
        "r.bracketedPaste": true,
        "r.plot.useHttpgd": true,
        "r.rterm.linux": "/usr/bin/R"
      }
    }
  },
  "forwardPorts": [3838, 8787],
  "postCreateCommand": "echo 'Neurosurgery Research Environment Ready' && R --version",
  "remoteUser": "root"
}
```

### Option C: Claude Desktop (No Terminal)

Even in Claude Desktop (claude.ai), you can:

1. **Ask Claude to write R scripts** and copy them to run locally
2. **Use Claude's code execution** for simpler analyses
3. **Generate complete analysis pipelines** to run on your machine

```
You: Analyze this CSV data [paste data] using meta-analysis.
     Give me the R code and interpret the results.

Claude: [Writes and explains R code, you run it locally]
```

-----

## Claude Skills for Neurosurgery

### Skill 1: Neurosurgery Literature Search

Create `.claude/skills/neurosurgery-literature/SKILL.md`:

```markdown
---
name: neurosurgery-literature
description: Comprehensive neurosurgical literature search with domain expertise
---

# Neurosurgery Literature Search

## Activation Triggers
- Questions about neurosurgical evidence, outcomes, techniques
- Systematic review search development
- Literature review for any neurosurgical topic

## Domain Knowledge Base

### Subspecialties & Common Topics

#### Vascular Neurosurgery
**Conditions**: Aneurysms (ruptured/unruptured), AVMs, dAVFs, cavernomas, moyamoya, stroke
**Procedures**: Clipping, bypass (EC-IC, STA-MCA), decompressive craniectomy, EVD
**Outcomes**: mRS, GOS, rebleeding, vasospasm, DCI, hydrocephalus
**MeSH**: "Intracranial Aneurysm", "Arteriovenous Malformations", "Stroke", "Decompressive Craniectomy"

#### Neuro-oncology
**Conditions**: Gliomas (LGG, HGG, GBM), meningiomas, metastases, pituitary adenomas, vestibular schwannomas, skull base tumors
**Procedures**: Craniotomy, awake surgery, fluorescence-guided resection (5-ALA), laser ablation (LITT), BCNU wafers
**Outcomes**: EOR, PFS, OS, KPS, neurological function, seizure control
**MeSH**: "Brain Neoplasms", "Glioblastoma", "Meningioma", "Pituitary Neoplasms"

#### Spine Surgery
**Conditions**: Degenerative disc disease, stenosis, spondylolisthesis, deformity, trauma, tumors, infections
**Procedures**: Discectomy, laminectomy, fusion (ACDF, ALIF, PLIF, TLIF, LLIF), decompression, corpectomy
**Outcomes**: ODI, NDI, VAS, Nurick, JOA, fusion rate, adjacent segment disease
**MeSH**: "Spinal Fusion", "Diskectomy", "Laminectomy", "Spinal Stenosis"

#### Functional Neurosurgery
**Conditions**: Parkinson's, essential tremor, dystonia, epilepsy, chronic pain, spasticity, OCD, depression
**Procedures**: DBS, lesioning (RF, Gamma Knife, MRgFUS), epilepsy surgery (ATL, SAH, laser ablation), SCS, ITB pumps, VNS
**Outcomes**: UPDRS, tremor scales, Engel classification, seizure freedom, pain NRS/VAS
**MeSH**: "Deep Brain Stimulation", "Epilepsy Surgery", "Spinal Cord Stimulation"

#### Pediatric Neurosurgery
**Conditions**: Hydrocephalus, Chiari malformation, craniosynostosis, tethered cord, spina bifida, pediatric tumors
**Procedures**: VP shunt, ETV, Chiari decompression, cranial vault remodeling, myelomeningocele repair
**Outcomes**: Shunt revision rate, ETV success, developmental outcomes, cosmetic outcomes
**MeSH**: "Hydrocephalus", "Arnold-Chiari Malformation", "Craniosynostoses"

#### Trauma
**Conditions**: TBI (mild/moderate/severe), EDH, SDH, contusions, DAI, skull fractures, spine trauma, SCI
**Procedures**: Craniotomy, craniectomy, ICP monitoring, decompressive craniectomy
**Outcomes**: GCS, GOS/GOS-E, mortality, ICP control, ASIA score
**MeSH**: "Craniocerebral Trauma", "Intracranial Pressure", "Spinal Cord Injuries"

#### CSF Disorders
**Conditions**: NPH, IIH, CSF leaks, spontaneous intracranial hypotension
**Procedures**: VP shunt, LP shunt, ETV, blood patch, surgical repair
**Outcomes**: Gait improvement, cognitive improvement, opening pressure
**MeSH**: "Hydrocephalus, Normal Pressure", "Pseudotumor Cerebri"

### Outcome Scales Reference

| Scale | Range | Use | Better Score |
|-------|-------|-----|--------------|
| GCS | 3-15 | Consciousness | Higher |
| GOS | 1-5 | Global outcome | Higher |
| GOS-E | 1-8 | Extended global | Higher |
| mRS | 0-6 | Stroke disability | Lower |
| KPS | 0-100 | Performance status | Higher |
| NIHSS | 0-42 | Stroke severity | Lower |
| ODI | 0-100 | Lumbar disability | Lower |
| NDI | 0-100 | Cervical disability | Lower |
| VAS | 0-10 | Pain intensity | Lower |
| Engel | I-IV | Seizure outcome | Class I best |
| UPDRS | 0-199 | Parkinson's severity | Lower |
| JOA | 0-17 | Myelopathy | Higher |

### Search Strategy Templates

#### Basic Template
```
([Condition] OR [Synonyms]) AND
([Intervention] OR [Procedure synonyms]) AND
([Outcome terms])
Filters: humans, english, 2015-2025
```

#### High-Quality Evidence Filter
```
AND (randomized controlled trial[pt] OR meta-analysis[pt] OR
systematic review[pt] OR clinical trial[pt])
```

#### Neurosurgery Journal Filter
```
AND ("J Neurosurg"[Journal] OR "Neurosurgery"[Journal] OR
"World Neurosurg"[Journal] OR "J Neurotrauma"[Journal] OR
"Spine"[Journal] OR "Eur Spine J"[Journal] OR
"Acta Neurochir"[Journal] OR "Br J Neurosurg"[Journal])
```
```

## Python Search Script

```python
#!/usr/bin/env python3
"""
neurosurgery_search.py - PubMed search for neurosurgical literature
"""

import sys
import argparse
from Bio import Entrez
from datetime import datetime

Entrez.email = "researcher@institution.edu"

# Predefined search templates
TEMPLATES = {
    "vascular": '("Intracranial Aneurysm"[MeSH] OR "Arteriovenous Malformations"[MeSH] OR "Stroke"[MeSH])',
    "oncology": '("Brain Neoplasms"[MeSH] OR "Glioma"[MeSH] OR "Meningioma"[MeSH])',
    "spine": '("Spinal Diseases"[MeSH] OR "Spinal Fusion"[MeSH] OR "Intervertebral Disc"[MeSH])',
    "functional": '("Deep Brain Stimulation"[MeSH] OR "Epilepsy Surgery"[MeSH])',
    "pediatric": '("Hydrocephalus"[MeSH] OR "Arnold-Chiari Malformation"[MeSH])',
    "trauma": '("Craniocerebral Trauma"[MeSH] OR "Spinal Cord Injuries"[MeSH])',
}

def build_query(topic, intervention=None, outcome=None, years=5, study_type=None):
    """Build a structured PubMed query."""

    # Check if using template
    if topic.lower() in TEMPLATES:
        condition = TEMPLATES[topic.lower()]
    else:
        condition = f'("{topic}"[MeSH] OR "{topic}"[Title/Abstract])'

    query_parts = [condition]

    if intervention:
        query_parts.append(f'AND ("{intervention}"[MeSH] OR "{intervention}"[Title/Abstract])')

    if outcome:
        query_parts.append(f'AND ("{outcome}"[Title/Abstract])')

    # Date filter
    current_year = datetime.now().year
    start_year = current_year - years
    query_parts.append(f'AND ("{start_year}"[PDAT]:"{current_year}"[PDAT])')

    # Study type filter
    if study_type:
        type_filters = {
            "rct": "randomized controlled trial[pt]",
            "meta": "meta-analysis[pt]",
            "sr": "systematic review[pt]",
            "cohort": "cohort studies[MeSH]"
        }
        if study_type.lower() in type_filters:
            query_parts.append(f'AND {type_filters[study_type.lower()]}')

    # Standard filters
    query_parts.append('AND humans[MeSH] AND english[Language]')

    return " ".join(query_parts)


def search_pubmed(query, max_results=20):
    """Execute PubMed search and return structured results."""

    handle = Entrez.esearch(db="pubmed", term=query, retmax=max_results, sort="relevance")
    results = Entrez.read(handle)
    handle.close()

    pmids = results["IdList"]
    total_count = int(results["Count"])

    if not pmids:
        return [], total_count

    handle = Entrez.efetch(db="pubmed", id=",".join(pmids), rettype="xml")
    records = Entrez.read(handle)
    handle.close()

    articles = []
    for article in records.get("PubmedArticle", []):
        medline = article.get("MedlineCitation", {})
        article_data = medline.get("Article", {})

        # Extract fields
        pmid = str(medline.get("PMID", ""))
        title = article_data.get("ArticleTitle", "")

        # Authors
        authors = article_data.get("AuthorList", [])
        if authors:
            first = authors[0].get("LastName", "")
            author_str = f"{first} et al." if len(authors) > 1 else first
        else:
            author_str = "Unknown"

        # Journal info
        journal = article_data.get("Journal", {})
        journal_name = journal.get("ISOAbbreviation", journal.get("Title", ""))
        pub_date = journal.get("JournalIssue", {}).get("PubDate", {})
        year = pub_date.get("Year", "")[:4] if pub_date.get("Year") else ""

        # Abstract
        abstract_parts = article_data.get("Abstract", {}).get("AbstractText", [])
        if abstract_parts:
            abstract = " ".join([str(p) for p in abstract_parts])
        else:
            abstract = ""

        # Publication type
        pub_types = [str(pt) for pt in article_data.get("PublicationTypeList", [])]

        articles.append({
            "pmid": pmid,
            "title": title,
            "authors": author_str,
            "journal": journal_name,
            "year": year,
            "abstract": abstract,
            "pub_types": pub_types,
            "url": f"https://pubmed.ncbi.nlm.nih.gov/{pmid}/"
        })

    return articles, total_count


def format_output(articles, total_count, query, format_type="text"):
    """Format results for output."""

    if format_type == "markdown":
        output = [f"# PubMed Search Results\n"]
        output.append(f"**Query:** `{query}`\n")
        output.append(f"**Total results:** {total_count} | **Showing:** {len(articles)}\n")
        output.append("---\n")

        for i, a in enumerate(articles, 1):
            output.append(f"### {i}. {a['authors']} ({a['year']})\n")
            output.append(f"**{a['title']}**\n\n")
            output.append(f"*{a['journal']}* | PMID: [{a['pmid']}]({a['url']})\n\n")
            if a['abstract']:
                output.append(f"> {a['abstract'][:300]}...\n\n")
            output.append(f"Study types: {', '.join(a['pub_types'])}\n\n")

        return "\n".join(output)

    else:  # text format
        output = [f"\n{'='*70}"]
        output.append(f"PubMed Search: {len(articles)} of {total_count} results")
        output.append(f"Query: {query[:100]}...")
        output.append(f"{'='*70}\n")

        for i, a in enumerate(articles, 1):
            output.append(f"[{i}] {a['authors']} ({a['year']})")
            output.append(f"    {a['title']}")
            output.append(f"    {a['journal']} | PMID: {a['pmid']}")
            output.append(f"    {a['url']}")
            types_str = ", ".join(a['pub_types'][:3])
            output.append(f"    Types: {types_str}")
            output.append("")

        return "\n".join(output)


def main():
    parser = argparse.ArgumentParser(description="Search PubMed for neurosurgical literature")
    parser.add_argument("topic", help="Search topic or template (vascular, oncology, spine, functional, pediatric, trauma)")
    parser.add_argument("-i", "--intervention", help="Intervention or procedure")
    parser.add_argument("-o", "--outcome", help="Outcome of interest")
    parser.add_argument("-n", "--max-results", type=int, default=15, help="Maximum results (default: 15)")
    parser.add_argument("-y", "--years", type=int, default=5, help="Years to search (default: 5)")
    parser.add_argument("-t", "--type", choices=["rct", "meta", "sr", "cohort"], help="Study type filter")
    parser.add_argument("-f", "--format", choices=["text", "markdown"], default="text", help="Output format")
    parser.add_argument("--save", help="Save results to file")

    args = parser.parse_args()

    query = build_query(
        args.topic,
        intervention=args.intervention,
        outcome=args.outcome,
        years=args.years,
        study_type=args.type
    )

    articles, total = search_pubmed(query, args.max_results)
    output = format_output(articles, total, query, args.format)

    print(output)

    if args.save:
        with open(args.save, 'w') as f:
            f.write(output)
        print(f"\nSaved to {args.save}")


if __name__ == "__main__":
    main()
```

## Usage Examples

```bash
# Basic search
python neurosurgery_search.py "glioblastoma"

# With intervention and outcome
python neurosurgery_search.py "glioblastoma" -i "surgical resection" -o "survival"

# Only RCTs from last 10 years
python neurosurgery_search.py "deep brain stimulation" -t rct -y 10

# Use template + save as markdown
python neurosurgery_search.py vascular -i "clipping" --format markdown --save search_results.md
```

### Skill 2: Data Extraction & Validation

Create `.claude/skills/data-extraction/SKILL.md`:

```markdown
---
name: data-extraction
description: Extract, validate, and transform data from neurosurgical studies
---

# Data Extraction Skill

## Activation Triggers
- User mentions data extraction, extraction form, or data collection
- User has PDFs to extract from
- User needs to validate or transform extracted data

## Standard Extraction Schema

### study_characteristics.yaml
```yaml
study_id: ""  # FirstAuthor_Year
title: ""
authors: []
year:
country: ""
institution: ""
study_design: ""  # RCT, prospective_cohort, retrospective_cohort, case_control, case_series
multicenter: false
centers_n:
registration: ""  # NCT number or other registry
funding: ""
conflicts: ""
```

### population.yaml
```yaml
sample_size:
  total:
  intervention:
  control:

demographics:
  age:
    mean:
    sd:
    median:
    iqr: []
    range: []
  sex:
    male_n:
    male_pct:
    female_n:
    female_pct:

diagnosis:
  condition: ""
  subtype: ""
  severity_scale: ""
  severity_value:

inclusion_criteria: []
exclusion_criteria: []

comorbidities:
  hypertension_pct:
  diabetes_pct:
  smoking_pct:
  previous_surgery_pct:
```

### intervention.yaml
```yaml
intervention:
  name: ""
  category: ""  # surgical, medical, device, combination
  details: ""
  approach: ""
  technique: ""
  duration_min:
  timing: ""  # early (<24h), delayed, elective

comparator:
  name: ""
  type: ""  # active, placebo, standard_care, historical
  details: ""

concomitant_treatments: []
```

### outcomes.yaml
```yaml
primary_outcome:
  name: ""
  definition: ""
  measurement_tool: ""
  timing: ""
  assessor_blinding: false

secondary_outcomes:
  - name: ""
    definition: ""
    timing: ""

follow_up:
  duration_months:
  completeness_pct:
  loss_to_followup_n:
```

### results.yaml
```yaml
# For binary outcomes
binary_outcomes:
  - outcome: ""
    intervention:
      events:
      total:
      pct:
    control:
      events:
      total:
      pct:
    effect:
      measure: ""  # OR, RR, HR, RD
      estimate:
      ci_lower:
      ci_upper:
      p_value:

# For continuous outcomes
continuous_outcomes:
  - outcome: ""
    intervention:
      n:
      mean:
      sd:
      median:
      iqr: []
    control:
      n:
      mean:
      sd:
      median:
      iqr: []
    effect:
      measure: ""  # MD, SMD
      estimate:
      ci_lower:
      ci_upper:
      p_value:

# For time-to-event
survival_outcomes:
  - outcome: ""
    intervention:
      events:
      total:
      median_months:
    control:
      events:
      total:
      median_months:
    effect:
      hr:
      ci_lower:
      ci_upper:
      p_value:
```

### risk_of_bias.yaml
```yaml
# For RCTs (RoB 2)
rob2:
  randomization:
    judgment: ""  # low, some_concerns, high
    support: ""
  deviations:
    judgment: ""
    support: ""
  missing_data:
    judgment: ""
    support: ""
  measurement:
    judgment: ""
    support: ""
  selection:
    judgment: ""
    support: ""
  overall:
    judgment: ""

# For observational (Newcastle-Ottawa)
newcastle_ottawa:
  selection:
    representativeness: 0  # 0 or 1
    selection_non_exposed: 0
    ascertainment_exposure: 0
    outcome_not_present: 0
  comparability:
    main_factor: 0
    additional_factor: 0
  outcome:
    assessment: 0
    follow_up_length: 0
    follow_up_adequacy: 0
  total_stars: 0
```

## Effect Size Calculations

### R Functions for Conversions

```r
library(esc)
library(metafor)

# =========================================
# EFFECT SIZE CONVERSIONS
# =========================================

# From 2x2 table (binary outcomes)
calc_or_from_2x2 <- function(a, b, c, d) {
  # a = intervention events, b = intervention non-events
  # c = control events, d = control non-events
  or <- (a * d) / (b * c)
  se_log_or <- sqrt(1/a + 1/b + 1/c + 1/d)
  ci_lower <- exp(log(or) - 1.96 * se_log_or)
  ci_upper <- exp(log(or) + 1.96 * se_log_or)
  list(or = or, se = se_log_or, ci_lower = ci_lower, ci_upper = ci_upper)
}

# From means and SDs (continuous outcomes)
calc_smd <- function(m1, sd1, n1, m2, sd2, n2) {
  esc_mean_sd(grp1m = m1, grp1sd = sd1, grp1n = n1,
              grp2m = m2, grp2sd = sd2, grp2n = n2,
              es.type = "g")  # Hedges' g
}

# From median and IQR (convert to mean/SD)
median_iqr_to_mean_sd <- function(median, q1, q3, n) {
  # Wan et al. (2014) method
  mean_est <- (q1 + median + q3) / 3
  sd_est <- (q3 - q1) / 1.35
  list(mean = mean_est, sd = sd_est)
}

# From median and range
median_range_to_mean_sd <- function(median, min, max, n) {
  # Hozo et al. (2005) method
  mean_est <- (min + 2*median + max) / 4
  sd_est <- (max - min) / 4
  list(mean = mean_est, sd = sd_est)
}

# From proportion (single group)
calc_logit_proportion <- function(events, total) {
  p <- events / total
  logit_p <- log(p / (1 - p))
  se <- sqrt(1/(events) + 1/(total - events))
  list(logit = logit_p, se = se, proportion = p)
}

# From HR (time-to-event)
# If only HR and CI reported
calc_se_from_hr_ci <- function(hr, ci_lower, ci_upper) {
  log_hr <- log(hr)
  se <- (log(ci_upper) - log(ci_lower)) / (2 * 1.96)
  list(log_hr = log_hr, se = se)
}

# Reconstruct IPD from Kaplan-Meier
# Use IPDfromKM package for digitized curves
```

## Data Validation Rules

```r
validate_extraction <- function(data) {
  errors <- c()
  warnings <- c()

  # Required fields
  required <- c("study_id", "year", "sample_size", "intervention")
  for (field in required) {
    if (is.null(data[[field]]) || is.na(data[[field]])) {
      errors <- c(errors, paste("Missing required field:", field))
    }
  }

  # Logical checks
  if (!is.null(data$events) && !is.null(data$total)) {
    if (data$events > data$total) {
      errors <- c(errors, "Events cannot exceed total sample size")
    }
  }

  # Percentage checks
  pct_fields <- c("male_pct", "female_pct", "loss_to_followup_pct")
  for (field in pct_fields) {
    if (!is.null(data[[field]])) {
      if (data[[field]] < 0 || data[[field]] > 100) {
        errors <- c(errors, paste(field, "must be 0-100"))
      }
    }
  }

  # CI check
  if (!is.null(data$ci_lower) && !is.null(data$ci_upper)) {
    if (data$ci_lower >= data$ci_upper) {
      errors <- c(errors, "CI lower must be < CI upper")
    }
  }

  # Sample size consistency
  if (!is.null(data$n_intervention) && !is.null(data$n_control) && !is.null(data$total)) {
    if (data$n_intervention + data$n_control != data$total) {
      warnings <- c(warnings, "Group sizes don't sum to total")
    }
  }

  list(valid = length(errors) == 0, errors = errors, warnings = warnings)
}
```
```

### Skill 3: Meta-Analysis Engine

Create `.claude/skills/meta-analysis/SKILL.md`:

```markdown
---
name: meta-analysis
description: Complete meta-analysis generation for neurosurgical outcomes
---

# Meta-Analysis Skill

## Activation Triggers
- User has extraction data ready for analysis
- Requests for forest plots, funnel plots, heterogeneity
- Questions about pooling, subgroups, sensitivity analysis

## Complete R Analysis Templates

### Template 1: Binary Outcomes Meta-Analysis

```r
#!/usr/bin/env Rscript
# meta_binary.R - Meta-analysis for binary outcomes
# Usage: Rscript meta_binary.R --input data.csv --outcome mortality

library(meta)
library(metafor)
library(dmetar)
library(forestplot)
library(grid)

# =========================================
# LOAD AND PREPARE DATA
# =========================================

# Expected columns:
# study, year, events_int, n_int, events_ctrl, n_ctrl, [subgroup]

data <- read.csv("extractions/pooled_data.csv")

# =========================================
# MAIN META-ANALYSIS
# =========================================

ma <- metabin(
  event.e = events_int,
  n.e = n_int,
  event.c = events_ctrl,
  n.c = n_ctrl,
  studlab = paste(study, year),
  data = data,
  sm = "OR",                    # Effect measure: OR, RR, RD
  method = "MH",                # Pooling: MH, Inverse, GLMM, Peto
  random = TRUE,
  fixed = FALSE,
  prediction = TRUE,            # Prediction interval
  hakn = TRUE,                  # Knapp-Hartung adjustment
  title = "Mortality: Intervention vs Control"
)

# Print summary
summary(ma)

# =========================================
# FOREST PLOT
# =========================================

png("figures/forest_mortality.png", width = 1400, height = 800, res = 150)

forest(ma,
       sortvar = TE,
       prediction = TRUE,
       print.tau2 = TRUE,
       print.pval.Q = TRUE,
       print.I2 = TRUE,
       leftcols = c("studlab", "event.e", "n.e", "event.c", "n.c"),
       leftlabs = c("Study", "Events", "N", "Events", "N"),
       rightcols = c("effect", "ci", "w.random"),
       rightlabs = c("OR", "95% CI", "Weight"),
       col.square = "navy",
       col.diamond = "maroon",
       col.predict = "darkgreen",
       fontsize = 10,
       spacing = 1.2,
       squaresize = 0.5,
       lwd = 1.5)

dev.off()
cat("Saved: figures/forest_mortality.png\n")

# =========================================
# HETEROGENEITY ASSESSMENT
# =========================================

cat("\n=== HETEROGENEITY ===\n")
cat(sprintf("I² = %.1f%% [%.1f%%, %.1f%%]\n",
            ma$I2 * 100, ma$lower.I2 * 100, ma$upper.I2 * 100))
cat(sprintf("τ² = %.4f\n", ma$tau2))
cat(sprintf("Q = %.2f, df = %d, p = %.4f\n", ma$Q, ma$df.Q, ma$pval.Q))
cat(sprintf("Prediction interval: [%.2f, %.2f]\n",
            exp(ma$lower.predict), exp(ma$upper.predict)))

# Interpretation
if (ma$I2 < 0.25) {
  cat("Interpretation: LOW heterogeneity\n")
} else if (ma$I2 < 0.50) {
  cat("Interpretation: MODERATE heterogeneity\n")
} else if (ma$I2 < 0.75) {
  cat("Interpretation: SUBSTANTIAL heterogeneity\n")
} else {
  cat("Interpretation: CONSIDERABLE heterogeneity\n")
}

# =========================================
# PUBLICATION BIAS
# =========================================

cat("\n=== PUBLICATION BIAS ===\n")

# Funnel plot
png("figures/funnel_mortality.png", width = 800, height = 600, res = 150)
funnel(ma, studlab = TRUE, cex.studlab = 0.7)
dev.off()
cat("Saved: figures/funnel_mortality.png\n")

# Statistical tests (need k >= 10)
if (ma$k >= 10) {
  # Peters' test (for binary outcomes - preferred)
  peters <- metabias(ma, method = "Peters")
  cat(sprintf("Peters' test: t = %.2f, p = %.4f\n", peters$statistic, peters$p.value))

  # Trim-and-fill
  tf <- trimfill(ma)
  cat(sprintf("Trim-and-fill: %d studies imputed\n", tf$k0))
  cat(sprintf("Adjusted OR: %.2f [%.2f, %.2f]\n",
              exp(tf$TE.random), exp(tf$lower.random), exp(tf$upper.random)))

  # Funnel with trim-fill
  png("figures/funnel_trimfill.png", width = 800, height = 600, res = 150)
  funnel(tf, studlab = TRUE)
  dev.off()
} else {
  cat("Note: k < 10, publication bias tests unreliable\n")
}

# =========================================
# SENSITIVITY ANALYSES
# =========================================

cat("\n=== SENSITIVITY ANALYSES ===\n")

# Leave-one-out
l1o <- metainf(ma, pooled = "random")
png("figures/leave_one_out.png", width = 1000, height = 600, res = 150)
forest(l1o)
dev.off()
cat("Saved: figures/leave_one_out.png\n")

# Influence diagnostics
inf <- influence(ma)
png("figures/influence.png", width = 1000, height = 800, res = 150)
plot(inf)
dev.off()
cat("Saved: figures/influence.png\n")

# Cumulative meta-analysis (by year)
cum <- metacum(ma, sortvar = data$year)
png("figures/cumulative.png", width = 1000, height = 600, res = 150)
forest(cum)
dev.off()
cat("Saved: figures/cumulative.png\n")

# =========================================
# SUBGROUP ANALYSIS
# =========================================

if ("subgroup" %in% names(data)) {
  cat("\n=== SUBGROUP ANALYSIS ===\n")

  ma_sub <- update(ma, subgroup = data$subgroup)

  png("figures/forest_subgroup.png", width = 1400, height = 1000, res = 150)
  forest(ma_sub,
         sortvar = TE,
         prediction = TRUE,
         subgroup = TRUE,
         print.subgroup.labels = TRUE)
  dev.off()
  cat("Saved: figures/forest_subgroup.png\n")

  # Test for subgroup differences
  cat(sprintf("Test for subgroup differences: Q = %.2f, p = %.4f\n",
              ma_sub$Q.b.random, ma_sub$pval.Q.b.random))
}

# =========================================
# EXPORT RESULTS
# =========================================

results <- data.frame(
  analysis = "Main analysis",
  k = ma$k,
  effect_measure = ma$sm,
  pooled_estimate = exp(ma$TE.random),
  ci_lower = exp(ma$lower.random),
  ci_upper = exp(ma$upper.random),
  p_value = ma$pval.random,
  I2 = ma$I2,
  tau2 = ma$tau2,
  Q = ma$Q,
  Q_pval = ma$pval.Q,
  prediction_lower = exp(ma$lower.predict),
  prediction_upper = exp(ma$upper.predict)
)

write.csv(results, "results/meta_analysis_results.csv", row.names = FALSE)
cat("\nSaved: results/meta_analysis_results.csv\n")

cat("\n=== ANALYSIS COMPLETE ===\n")
```

### Template 2: Continuous Outcomes

```r
#!/usr/bin/env Rscript
# meta_continuous.R - Meta-analysis for continuous outcomes

library(meta)
library(metafor)

data <- read.csv("extractions/continuous_data.csv")
# Expected: study, year, n_int, mean_int, sd_int, n_ctrl, mean_ctrl, sd_ctrl

ma <- metacont(
  n.e = n_int,
  mean.e = mean_int,
  sd.e = sd_int,
  n.c = n_ctrl,
  mean.c = mean_ctrl,
  sd.c = sd_ctrl,
  studlab = paste(study, year),
  data = data,
  sm = "MD",          # or "SMD" for standardized
  random = TRUE,
  hakn = TRUE,
  prediction = TRUE
)

summary(ma)

png("figures/forest_continuous.png", width = 1200, height = 800, res = 150)
forest(ma, sortvar = TE, prediction = TRUE)
dev.off()
```

### Template 3: Proportions (Single Arm)

```r
#!/usr/bin/env Rscript
# meta_proportions.R - Meta-analysis of proportions (single arm studies)

library(meta)

data <- read.csv("extractions/proportion_data.csv")
# Expected: study, year, events, total

ma <- metaprop(
  event = events,
  n = total,
  studlab = paste(study, year),
  data = data,
  sm = "PLOGIT",      # logit transformation (recommended)
  random = TRUE,
  hakn = TRUE,
  prediction = TRUE,
  method.ci = "CP"    # Clopper-Pearson CI for individual studies
)

summary(ma)

# Back-transform for interpretation
cat(sprintf("\nPooled proportion: %.1f%% [%.1f%%, %.1f%%]\n",
            ma$TE.random * 100, ma$lower.random * 100, ma$upper.random * 100))

png("figures/forest_proportion.png", width = 1200, height = 800, res = 150)
forest(ma, sortvar = TE, prediction = TRUE,
       leftcols = c("studlab", "event", "n"),
       rightcols = c("effect", "ci"))
dev.off()
```

### Template 4: Network Meta-Analysis

```r
#!/usr/bin/env Rscript
# network_meta.R - Network meta-analysis

library(netmeta)
library(meta)

data <- read.csv("extractions/network_data.csv")

# Pairwise data
nma <- netmeta(
  TE = log(OR),
  seTE = seTE,
  treat1 = treat1,
  treat2 = treat2,
  studlab = study,
  data = data,
  sm = "OR",
  random = TRUE,
  reference.group = "placebo"
)

summary(nma)

# Network plot
png("figures/network_plot.png", width = 800, height = 800, res = 150)
netgraph(nma,
         plastic = TRUE,
         thickness = "number.of.studies",
         points = TRUE)
dev.off()

# Forest plot vs reference
png("figures/network_forest.png", width = 1000, height = 800, res = 150)
forest(nma, reference.group = "placebo", sortvar = -TE)
dev.off()

# League table
league <- netleague(nma, digits = 2)
write.csv(league$random, "results/league_table.csv")

# Ranking
ranking <- netrank(nma, small.values = "good")
print(ranking)
```

### Template 5: Survival/Time-to-Event

```r
#!/usr/bin/env Rscript
# meta_survival.R - Meta-analysis of hazard ratios

library(meta)
library(metafor)

data <- read.csv("extractions/survival_data.csv")
# Expected: study, year, log_hr, se_log_hr (or hr, ci_lower, ci_upper)

# If only HR and CI available, calculate log_hr and SE:
if (!"log_hr" %in% names(data)) {
  data$log_hr <- log(data$hr)
  data$se_log_hr <- (log(data$ci_upper) - log(data$ci_lower)) / (2 * 1.96)
}

ma <- metagen(
  TE = log_hr,
  seTE = se_log_hr,
  studlab = paste(study, year),
  data = data,
  sm = "HR",
  random = TRUE,
  hakn = TRUE,
  prediction = TRUE
)

summary(ma)

png("figures/forest_hr.png", width = 1200, height = 800, res = 150)
forest(ma,
       sortvar = TE,
       prediction = TRUE,
       leftcols = c("studlab"),
       rightcols = c("effect", "ci", "w.random"),
       rightlabs = c("HR", "95% CI", "Weight"))
dev.off()

cat(sprintf("\nPooled HR: %.2f [%.2f, %.2f], p = %.4f\n",
            exp(ma$TE.random), exp(ma$lower.random), exp(ma$upper.random), ma$pval.random))
```

## GRADE Assessment Helper

```r
# Generate GRADE summary of findings
grade_assessment <- function(ma, outcome_name, baseline_risk = 0.10) {

  grade <- list(
    outcome = outcome_name,
    studies = ma$k,
    participants = sum(ma$n.e) + sum(ma$n.c),
    effect = sprintf("%.2f [%.2f, %.2f]",
                     exp(ma$TE.random), exp(ma$lower.random), exp(ma$upper.random)),

    # Start at HIGH for RCTs, LOW for observational
    initial_certainty = "HIGH",

    # Downgrade factors
    risk_of_bias = "Not serious",
    inconsistency = ifelse(ma$I2 > 0.5, "Serious (-1)", "Not serious"),
    indirectness = "Not serious",
    imprecision = ifelse(ma$lower.random * ma$upper.random < 0 ||
                         (exp(ma$upper.random) - exp(ma$lower.random)) > 1,
                         "Serious (-1)", "Not serious"),
    publication_bias = "Undetected"
  )

  # Calculate absolute effects
  control_risk <- baseline_risk
  intervention_risk <- (exp(ma$TE.random) * control_risk) /
                       (1 - control_risk + exp(ma$TE.random) * control_risk)

  grade$absolute_effect <- sprintf("%.0f fewer per 1000 (from %.0f fewer to %.0f fewer)",
                                   (control_risk - intervention_risk) * 1000,
                                   (control_risk - exp(ma$lower.random) * control_risk /
                                    (1 - control_risk + exp(ma$lower.random) * control_risk)) * 1000,
                                   (control_risk - exp(ma$upper.random) * control_risk /
                                    (1 - control_risk + exp(ma$upper.random) * control_risk)) * 1000)

  return(grade)
}
```
```

### Skill 4: Risk of Bias Visualization

Create `.claude/skills/rob-visualization/SKILL.md`:

```markdown
---
name: rob-visualization
description: Generate risk of bias visualizations using robvis
---

# Risk of Bias Visualization

## R Code for robvis

```r
#!/usr/bin/env Rscript
# rob_visualization.R

library(robvis)
library(ggplot2)

# =========================================
# ROB 2 (FOR RCTs)
# =========================================

# Expected CSV format:
# Study, D1, D2, D3, D4, D5, Overall
# where D1-D5 are domains, values: "Low", "Some concerns", "High"

rob2_data <- read.csv("quality_assessment/rob2_data.csv")

# Traffic light plot
rob2_traffic <- rob_traffic_light(
  data = rob2_data,
  tool = "ROB2",
  colour = "cochrane"
)

ggsave("figures/rob2_traffic_light.png", rob2_traffic,
       width = 12, height = 8, dpi = 300)

# Summary plot
rob2_summary <- rob_summary(
  data = rob2_data,
  tool = "ROB2",
  overall = TRUE,
  colour = "cochrane"
)

ggsave("figures/rob2_summary.png", rob2_summary,
       width = 10, height = 6, dpi = 300)

# =========================================
# NEWCASTLE-OTTAWA SCALE (OBSERVATIONAL)
# =========================================

nos_data <- read.csv("quality_assessment/nos_data.csv")

# Bar plot of NOS scores
nos_plot <- ggplot(nos_data, aes(x = reorder(Study, Total), y = Total)) +
  geom_col(aes(fill = factor(ifelse(Total >= 7, "Good",
                             ifelse(Total >= 5, "Fair", "Poor"))))) +
  geom_hline(yintercept = c(5, 7), linetype = "dashed", alpha = 0.5) +
  coord_flip() +
  scale_fill_manual(values = c("Good" = "#4CAF50", "Fair" = "#FFC107", "Poor" = "#F44336"),
                    name = "Quality") +
  labs(x = "", y = "Newcastle-Ottawa Scale Score (0-9)",
       title = "Risk of Bias: Newcastle-Ottawa Scale") +
  theme_minimal() +
  theme(legend.position = "bottom")

ggsave("figures/nos_scores.png", nos_plot, width = 10, height = 8, dpi = 300)

# =========================================
# ROBINS-I (NON-RANDOMIZED INTERVENTIONS)
# =========================================

robins_data <- read.csv("quality_assessment/robins_data.csv")

robins_traffic <- rob_traffic_light(
  data = robins_data,
  tool = "ROBINS-I"
)

ggsave("figures/robins_traffic_light.png", robins_traffic,
       width = 14, height = 10, dpi = 300)

# =========================================
# QUADAS-2 (DIAGNOSTIC ACCURACY)
# =========================================

quadas_data <- read.csv("quality_assessment/quadas_data.csv")

quadas_traffic <- rob_traffic_light(
  data = quadas_data,
  tool = "QUADAS-2"
)

ggsave("figures/quadas_traffic_light.png", quadas_traffic,
       width = 12, height = 8, dpi = 300)
```

## Data Templates

### rob2_data.csv
```csv
Study,D1,D2,D3,D4,D5,Overall
Smith 2020,Low,Low,Some concerns,Low,Low,Some concerns
Jones 2021,Low,Low,Low,Low,Low,Low
Brown 2022,High,Some concerns,Low,High,Some concerns,High
```

### nos_data.csv
```csv
Study,Selection,Comparability,Outcome,Total
Smith 2020,4,2,3,9
Jones 2021,3,2,2,7
Brown 2022,2,1,2,5
```
```

---

## Slash Commands Library

Create in `.claude/commands/`:

### `/nsr-search` - Neurosurgery Search

```markdown
---
name: nsr-search
description: Search neurosurgical literature
---

Search PubMed for neurosurgical literature on: $ARGUMENTS

1. Identify the subspecialty (vascular, oncology, spine, functional, pediatric, trauma)
2. Extract PICO elements
3. Build search with MeSH terms + free text
4. Add filters: humans, english, last 10 years
5. Execute search using the neurosurgery-literature skill
6. Summarize top 15 results by evidence level (RCT > cohort > case series)
7. Save as searches/[topic]_search.md
```

### `/extract` - Quick Extraction

```markdown
---
name: extract
description: Extract data from a study
---

Extract data from: $ARGUMENTS

Use the data-extraction skill schema. Create:
1. YAML file with all extracted fields
2. Validation check
3. Note any missing or unclear data

Save as extractions/[author]_[year].yaml
```

### `/meta` - Run Meta-Analysis

```markdown
---
name: meta
description: Run meta-analysis on extracted data
---

Run meta-analysis for: $ARGUMENTS

1. Load data from extractions/ folder
2. Determine outcome type (binary, continuous, proportion, survival)
3. Select appropriate model
4. Generate:
   - Forest plot
   - Funnel plot
   - Heterogeneity assessment
   - Leave-one-out sensitivity
5. Save figures to figures/
6. Save results summary to results/
7. Report key findings
```

### `/subgroup` - Subgroup Analysis

```markdown
---
name: subgroup
description: Run subgroup analysis
---

Run subgroup analysis for: $ARGUMENTS

Analyze by the specified grouping variable:
1. Generate subgroup forest plot
2. Test for subgroup differences
3. Report I² within and between subgroups
4. Save results

Interpret clinical significance of differences.
```

### `/prisma` - PRISMA Flow Diagram

```markdown
---
name: prisma
description: Generate PRISMA flow diagram
---

Generate PRISMA 2020 flow diagram with:

Records identified: $ARGUMENTS

Prompt me for:
- Records from each database
- Duplicates removed
- Records screened
- Records excluded (with reasons)
- Reports sought for retrieval
- Reports not retrieved (with reasons)
- Reports assessed for eligibility
- Reports excluded (with reasons by category)
- Studies included in review
- Studies included in meta-analysis (if different)

Generate using PRISMAstatement or PRISMA2020 R package.
Save as figures/prisma_flow.png
```

### `/grade` - GRADE Assessment

```markdown
---
name: grade
description: Generate GRADE summary of findings
---

Generate GRADE assessment for: $ARGUMENTS

For each outcome:
1. Start with initial certainty (HIGH for RCTs, LOW for observational)
2. Assess downgrade factors:
   - Risk of bias
   - Inconsistency (I²)
   - Indirectness
   - Imprecision
   - Publication bias
3. Assess upgrade factors (observational only):
   - Large effect
   - Dose-response
   - Plausible confounding

Generate Summary of Findings table.
Save as results/grade_[outcome].csv
```

### `/write-section` - Manuscript Section

```markdown
---
name: write-section
description: Draft manuscript section
---

Write the $ARGUMENTS section for my systematic review.

Follow PRISMA 2020 guidelines.
Use formal academic tone.
Include all required elements.
Use numbered citations [1], [2].
Target word count: appropriate for section.

Save as manuscript/[section].md
```

### `/table1` - Baseline Characteristics

```markdown
---
name: table1
description: Generate Table 1 baseline characteristics
---

Generate Table 1 (Baseline Characteristics) from my extracted data.

Include:
- Study characteristics (design, country, period)
- Sample sizes
- Demographics (age, sex)
- Disease characteristics
- Intervention details
- Follow-up duration

Format using gtsummary or flextable.
Export as Word-compatible table.
Save as tables/table1_characteristics.docx
```

### `/rob-table` - Risk of Bias Table

```markdown
---
name: rob-table
description: Generate risk of bias assessment
---

Generate risk of bias assessment for included studies.

Tool to use: $ARGUMENTS (ROB2, NOS, ROBINS-I, QUADAS-2, JBI)

1. Create assessment spreadsheet template
2. Guide through each domain
3. Generate traffic light plot
4. Generate summary plot
5. Save assessments to quality_assessment/
6. Save figures to figures/
```

-----

## Complete Systematic Review Workflow

### Phase 1: Protocol (Week 1)

```bash
claude

# Define research question
> Help me formulate a PICO question for a systematic review on
> [your topic, e.g., "awake craniotomy vs general anesthesia for eloquent gliomas"]

# Draft protocol
> Create a PROSPERO registration draft including:
> - Title, background, objectives
> - PICO criteria
> - Search strategy outline
> - Study selection process
> - Data extraction plan
> - Risk of bias tool
> - Data synthesis plan
> - Save as protocol/prospero_draft.md

# Commit
> Commit with message "Add systematic review protocol"
```

### Phase 2: Search (Week 2)

```bash
# Develop search strategy
> /nsr-search awake craniotomy glioma outcomes

# Refine search
> Expand the search to include:
> - Alternative terms (asleep-awake-asleep, monitored anesthesia care)
> - Related outcomes (extent of resection, neurological function, seizures)
> - No date limits for initial search

# Export searches
> Format search strategies for:
> - PubMed/MEDLINE
> - Embase (via Ovid)
> - Cochrane CENTRAL
> - Web of Science
> Save each as searches/[database]_strategy.txt

# Run searches and deduplicate
> Help me deduplicate my search results in dedupe_results.csv
> Use revtools or manual approach
```

### Phase 3: Screening (Weeks 3-4)

```bash
# Create screening tool
> Create a Shiny app for title/abstract screening that:
> - Loads my deduplicated references from screening/references.csv
> - Shows title and abstract
> - Has buttons: Include, Exclude, Maybe
> - Records exclusion reasons from a dropdown
> - Tracks progress
> - Exports decisions to screening/decisions.csv

# After screening
> Generate a screening summary:
> - Total screened
> - Included/excluded/maybe counts
> - Top exclusion reasons
> - Kappa for dual screening (if applicable)
```

### Phase 4: Full-Text Review (Week 5)

```bash
# Eligibility assessment
> Create a full-text eligibility form with checkboxes for:
> - Population: Adults with eloquent gliomas
> - Intervention: Awake craniotomy
> - Comparator: General anesthesia
> - Outcomes: EOR, function, survival reported
> - Study design: Comparative study
> Save template as screening/fulltext_form.yaml

# After review
> /prisma identification=2547 screening=1823 fulltext=87 included=23
```

### Phase 5: Data Extraction (Weeks 6-7)

```bash
# Extract each study
> /extract Smith_2020_awake_vs_GA_glioma.pdf

# Repeat for all studies...

# Compile extractions
> Compile all YAML extractions in extractions/ into a single CSV
> Validate data consistency
> Flag any missing critical fields
> Save as extractions/pooled_data.csv
```

### Phase 6: Quality Assessment (Week 8)

```bash
# Assess risk of bias
> /rob-table NOS  # for cohort studies

# Or for RCTs
> /rob-table ROB2

# Generate visualizations
> Generate rob traffic light and summary plots
```

### Phase 7: Meta-Analysis (Weeks 9-10)

```bash
# Main analyses
> /meta extent of resection (GTR rate)
> /meta neurological deficit rate
> /meta overall survival HR
> /meta seizure freedom rate

# Subgroup analyses
> /subgroup tumor location (frontal vs temporal vs parietal)
> /subgroup mapping technique (cortical vs subcortical)

# Sensitivity analyses
> Run sensitivity analysis excluding high risk of bias studies
> Run sensitivity analysis using different effect measures

# Publication bias
> Assess publication bias for primary outcome with:
> - Funnel plot
> - Egger's test
> - Trim-and-fill
```

### Phase 8: Manuscript (Weeks 11-12)

```bash
# Generate tables
> /table1

# Write sections
> /write-section Introduction
> /write-section Methods
> /write-section Results
> /write-section Discussion

# GRADE assessment
> /grade primary outcome (GTR rate)
> /grade secondary outcome (neurological deficit)

# Abstract
> Write a structured abstract (300 words) with:
> Background, Methods, Results, Conclusions

# Final review
> /clear
> Read manuscript/full_manuscript.md and provide critical feedback

# Prepare submission
> Format manuscript for [Journal of Neurosurgery]
> Generate cover letter
> Compile supplementary materials
```

-----

## Daily Workflow Commands

```bash
# Morning: Start work
cd ~/Documents/systematic-review
claude

# Quick status check
> Show me project status: what files exist, what's complete, what's pending

# Continue work
> Let's continue with [specific task]

# Run analysis
> /meta mortality

# End of day: Save progress
> Commit all changes with message "Progress on [task]"
> Push to origin
```

-----

## Quick Reference Card

### R Commands in Terminal

```bash
# Execute script
Rscript script.R

# Quick calculation
R -e 'library(meta); print(metabin(10, 50, 5, 50))'

# Interactive session
R
> # your commands
> q()

# Run silently
R -q -f script.R

# With arguments
Rscript script.R --input data.csv
```

### Key Packages

| Package | Use |
|---------|-----|
| `meta` | Main meta-analysis |
| `metafor` | Advanced methods |
| `dmetar` | Companion tools |
| `robvis` | Risk of bias plots |
| `forestplot` | Custom forest plots |
| `netmeta` | Network meta-analysis |
| `PRISMAstatement` | Flow diagrams |
| `gtsummary` | Table 1 |
| `esc` | Effect size conversions |

### Heterogeneity Interpretation

| I² | Interpretation |
|----|----------------|
| 0-25% | Low |
| 25-50% | Moderate |
| 50-75% | Substantial |
| >75% | Considerable |

### Effect Measures

| Data Type | Measures |
|-----------|----------|
| Binary | OR, RR, RD |
| Continuous | MD, SMD |
| Time-to-event | HR |
| Proportions | Logit, Freeman-Tukey |

-----

## File Structure Template

```
systematic-review/
├── .devcontainer/
│   ├── Dockerfile
│   └── devcontainer.json
├── .claude/
│   ├── commands/
│   │   ├── nsr-search.md
│   │   ├── extract.md
│   │   ├── meta.md
│   │   └── ...
│   └── skills/
│       ├── neurosurgery-literature/
│       ├── data-extraction/
│       ├── meta-analysis/
│       └── rob-visualization/
├── protocol/
│   ├── prospero_draft.md
│   └── protocol_v1.pdf
├── searches/
│   ├── pubmed_strategy.txt
│   ├── embase_strategy.txt
│   └── search_results.csv
├── screening/
│   ├── references.csv
│   ├── decisions.csv
│   └── fulltext_exclusions.csv
├── extractions/
│   ├── Smith_2020.yaml
│   ├── Jones_2021.yaml
│   └── pooled_data.csv
├── quality_assessment/
│   ├── rob2_data.csv
│   ├── nos_data.csv
│   └── grade_assessment.csv
├── analysis/
│   └── scripts/
│       ├── meta_primary.R
│       ├── meta_secondary.R
│       └── subgroup_analysis.R
├── figures/
│   ├── prisma_flow.png
│   ├── forest_primary.png
│   ├── funnel_primary.png
│   └── rob_summary.png
├── tables/
│   ├── table1_characteristics.docx
│   ├── table2_results.docx
│   └── table3_grade.docx
├── manuscript/
│   ├── introduction.md
│   ├── methods.md
│   ├── results.md
│   ├── discussion.md
│   └── full_manuscript.docx
├── submission/
│   ├── cover_letter.md
│   ├── highlights.txt
│   └── supplementary/
└── README.md
```

-----

## Resources

### Tutorials

- [Steven Ge's Vibe Tutorials](https://gexijin.github.io/vibe/)
- [Cochrane Handbook](https://training.cochrane.org/handbook)
- [metafor documentation](https://www.metafor-project.org/)

### Guidelines

- [PRISMA 2020](http://prisma-statement.org/)
- [GRADE Handbook](https://gdt.gradepro.org/app/handbook/handbook.html)
- [SAMPL Guidelines](https://www.equator-network.org/reporting-guidelines/sampl/)

### R Package Vignettes

- [meta package](https://cran.r-project.org/web/packages/meta/vignettes/meta-tutorial.html)
- [robvis](https://mcguinlu.shinyapps.io/robvis/)
- [dmetar](https://bookdown.org/MathiasHarrer/Doing_Meta_Analysis_in_R/)

-----

*Synthesized from Steven Ge's "Claude Code for Everyone" tutorials, adapted for neurosurgery research.*
