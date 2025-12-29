---
name: meta-analysis
version: 1.0.0
description: Complete meta-analysis generation for neurosurgical outcomes
author: NeuroResearch Agent
license: MIT

# Activation triggers - patterns that activate this skill
triggers:
  - pattern: "meta-analysis"
  - pattern: "forest plot"
  - pattern: "funnel plot"
  - pattern: "heterogeneity"
  - pattern: "pool.*studies"
  - pattern: "synthesize.*data"
  - pattern: "publication bias"
  - pattern: "subgroup analysis"
  - pattern: "sensitivity analysis"
  - pattern: "I-squared|I²"

# Required MCP servers
requires:
  - r-execute
  - filesystem

# Tools provided by this skill
tools:
  - name: analyze_binary
    description: Meta-analysis of binary outcomes (OR, RR, RD)
    script: scripts/binary_meta.R
    
  - name: analyze_continuous
    description: Meta-analysis of continuous outcomes (MD, SMD)
    script: scripts/continuous_meta.R
    
  - name: analyze_proportion
    description: Meta-analysis of proportions (single-arm studies)
    script: scripts/proportion_meta.R
    
  - name: analyze_survival
    description: Meta-analysis of hazard ratios
    script: scripts/survival_meta.R
    
  - name: generate_forest
    description: Generate publication-quality forest plot
    script: scripts/forest_plot.R
    
  - name: assess_heterogeneity
    description: Comprehensive heterogeneity assessment
    script: scripts/heterogeneity.R
    
  - name: assess_publication_bias
    description: Publication bias assessment
    script: scripts/publication_bias.R
    
  - name: run_subgroup
    description: Subgroup meta-analysis
    script: scripts/subgroup.R
    
  - name: run_sensitivity
    description: Sensitivity analyses (leave-one-out, influence)
    script: scripts/sensitivity.R

# Data schemas
schemas:
  binary_input:
    required:
      - study: string
      - events_int: integer
      - n_int: integer
      - events_ctrl: integer
      - n_ctrl: integer
    optional:
      - year: integer
      - subgroup: string
      
  continuous_input:
    required:
      - study: string
      - n_int: integer
      - mean_int: number
      - sd_int: number
      - n_ctrl: integer
      - mean_ctrl: number
      - sd_ctrl: number
    optional:
      - year: integer
      - subgroup: string
      
  proportion_input:
    required:
      - study: string
      - events: integer
      - total: integer
    optional:
      - year: integer
      - subgroup: string

# Output specifications
outputs:
  - figures/forest_*.png
  - figures/funnel_*.png
  - results/meta_summary.csv
  - results/heterogeneity.txt
  - results/publication_bias.txt
---

# Meta-Analysis Skill

## Overview

This skill provides comprehensive meta-analysis capabilities for neurosurgical systematic reviews. It supports binary outcomes (mortality, complications), continuous outcomes (scores, measurements), proportions (single-arm success rates), and survival data (hazard ratios).

## When to Use

Activate this skill when the user:
- Has extracted data ready for pooling
- Requests forest plots, funnel plots, or heterogeneity assessment
- Needs subgroup or sensitivity analyses
- Asks about publication bias or effect sizes
- Wants to synthesize results from multiple studies

## Workflow

### 1. Data Preparation

Before analysis, ensure data is in the correct format:

```csv
# Binary outcomes (2x2 data)
study,year,events_int,n_int,events_ctrl,n_ctrl,subgroup
Smith,2020,10,50,5,50,early
Jones,2021,15,60,8,55,late

# Continuous outcomes
study,year,n_int,mean_int,sd_int,n_ctrl,mean_ctrl,sd_ctrl
Smith,2020,50,25.3,5.2,50,30.1,6.1

# Proportions (single-arm)
study,year,events,total
Smith,2020,42,50
Jones,2021,38,55
```

### 2. Main Analysis

For binary outcomes (OR, RR, RD):
```
Run a meta-analysis of mortality using OR with random effects.
Input: extractions/pooled_data.csv
```

For continuous outcomes (MD, SMD):
```
Run a meta-analysis of ODI scores using MD.
Input: extractions/continuous_data.csv
```

For proportions:
```
Calculate the pooled proportion of surgical success.
Input: extractions/case_series_data.csv
```

### 3. Interpretation Guidelines

#### Effect Measures
- **OR (Odds Ratio)**: >1 favors control, <1 favors intervention
- **RR (Risk Ratio)**: Same interpretation as OR
- **MD (Mean Difference)**: Actual units, clinically interpretable
- **SMD (Standardized Mean Difference)**: 0.2 small, 0.5 medium, 0.8 large

#### Heterogeneity (I²)
- 0-25%: Low heterogeneity
- 25-50%: Moderate heterogeneity
- 50-75%: Substantial heterogeneity
- >75%: Considerable heterogeneity

When I² > 50%, consider:
1. Exploring sources via subgroup/meta-regression
2. Using random-effects model (default)
3. Reporting prediction interval
4. Conducting sensitivity analyses

#### Publication Bias
- Funnel plot asymmetry suggests bias
- Egger's test: p < 0.10 indicates asymmetry
- Peters' test: Preferred for binary outcomes
- Trim-and-fill: Estimates adjusted effect

### 4. Reporting Checklist

For each meta-analysis, generate:
- [ ] Forest plot with prediction interval
- [ ] Summary statistics (effect, CI, p-value)
- [ ] Heterogeneity statistics (I², τ², Q, prediction interval)
- [ ] Publication bias assessment (if k ≥ 10)
- [ ] Sensitivity analyses
- [ ] Subgroup analyses (if pre-specified)

## R Code Templates

### Binary Outcomes Template

```r
library(meta)
library(metafor)

data <- read.csv("{{INPUT}}")

ma <- metabin(
  event.e = events_int,
  n.e = n_int,
  event.c = events_ctrl,
  n.c = n_ctrl,
  studlab = paste(study, year),
  data = data,
  sm = "{{MEASURE}}",  # OR, RR, RD
  method = "MH",        # MH, Inverse, GLMM
  random = TRUE,
  fixed = FALSE,
  prediction = TRUE,
  hakn = TRUE           # Knapp-Hartung adjustment
)

# Forest plot
png("{{OUTPUT}}/forest_plot.png", width = 1200, height = 800, res = 150)
forest(ma,
       sortvar = TE,
       prediction = TRUE,
       print.tau2 = TRUE,
       print.I2 = TRUE,
       leftcols = c("studlab", "event.e", "n.e", "event.c", "n.c"),
       rightcols = c("effect", "ci", "w.random"))
dev.off()
```

### Heterogeneity Assessment

```r
# Comprehensive heterogeneity assessment
cat("=== HETEROGENEITY ASSESSMENT ===\n\n")

# Statistics
cat(sprintf("I² = %.1f%% [%.1f%%, %.1f%%]\n",
            ma$I2*100, ma$lower.I2*100, ma$upper.I2*100))
cat(sprintf("τ² = %.4f (τ = %.4f)\n", ma$tau2, sqrt(ma$tau2)))
cat(sprintf("H² = %.2f\n", ma$H^2))
cat(sprintf("Q = %.2f, df = %d, p = %.4f\n", ma$Q, ma$df.Q, ma$pval.Q))
cat(sprintf("\nPrediction interval: [%.2f, %.2f]\n",
            exp(ma$lower.predict), exp(ma$upper.predict)))

# Baujat plot (outlier detection)
png("{{OUTPUT}}/baujat_plot.png", width = 800, height = 600, res = 150)
baujat(ma)
dev.off()

# GOSH plot (if < 15 studies)
if (ma$k <= 15) {
  gosh_result <- gosh(ma)
  png("{{OUTPUT}}/gosh_plot.png", width = 800, height = 600, res = 150)
  plot(gosh_result)
  dev.off()
}
```

### Publication Bias Assessment

```r
# Only reliable if k >= 10
if (ma$k >= 10) {
  # Funnel plot
  png("{{OUTPUT}}/funnel_plot.png", width = 800, height = 600, res = 150)
  funnel(ma, studlab = TRUE, cex.studlab = 0.7)
  dev.off()
  
  # Contour-enhanced funnel plot
  png("{{OUTPUT}}/funnel_contour.png", width = 800, height = 600, res = 150)
  funnel(ma, contour = c(0.9, 0.95, 0.99),
         col.contour = c("darkgray", "gray", "lightgray"))
  legend("topright", c("p < 0.10", "p < 0.05", "p < 0.01"),
         fill = c("darkgray", "gray", "lightgray"), bty = "n")
  dev.off()
  
  # Statistical tests
  cat("\n=== PUBLICATION BIAS TESTS ===\n\n")
  
  # Egger's test (continuous outcomes)
  egger <- metabias(ma, method = "Egger")
  cat(sprintf("Egger's test: t = %.2f, p = %.4f\n",
              egger$statistic, egger$p.value))
  
  # Peters' test (binary outcomes - preferred)
  peters <- metabias(ma, method = "Peters")
  cat(sprintf("Peters' test: t = %.2f, p = %.4f\n",
              peters$statistic, peters$p.value))
  
  # Trim-and-fill
  tf <- trimfill(ma)
  cat(sprintf("\nTrim-and-fill: %d studies imputed\n", tf$k0))
  cat(sprintf("Adjusted estimate: %.2f [%.2f, %.2f]\n",
              exp(tf$TE.random), exp(tf$lower.random), exp(tf$upper.random)))
  
  # Funnel with imputed studies
  png("{{OUTPUT}}/funnel_trimfill.png", width = 800, height = 600, res = 150)
  funnel(tf, studlab = TRUE)
  dev.off()
  
} else {
  cat("\nNote: k < 10, publication bias tests unreliable.\n")
  cat("Visual inspection of funnel plot only.\n")
}
```

### Sensitivity Analyses

```r
# Leave-one-out analysis
l1o <- metainf(ma, pooled = "random")
png("{{OUTPUT}}/leave_one_out.png", width = 1000, height = 600, res = 150)
forest(l1o)
dev.off()

# Influence diagnostics
inf <- influence(ma)
png("{{OUTPUT}}/influence.png", width = 1000, height = 800, res = 150)
plot(inf)
dev.off()

# Cumulative meta-analysis (by year)
cum <- metacum(ma, sortvar = data$year)
png("{{OUTPUT}}/cumulative.png", width = 1000, height = 600, res = 150)
forest(cum)
dev.off()

# Report influential studies
cat("\n=== INFLUENTIAL STUDIES ===\n\n")
influential <- which(inf$is.infl)
if (length(influential) > 0) {
  cat("The following studies are potentially influential:\n")
  for (i in influential) {
    cat(sprintf("  - %s\n", ma$studlab[i]))
  }
} else {
  cat("No studies identified as influential.\n")
}
```

### Subgroup Analysis

```r
# Update with subgroup
ma_sub <- update(ma, subgroup = data${{SUBGROUP}})

# Forest plot with subgroups
png("{{OUTPUT}}/forest_subgroup.png", width = 1400, height = 1000, res = 150)
forest(ma_sub,
       sortvar = TE,
       prediction = TRUE,
       subgroup = TRUE,
       print.subgroup.labels = TRUE,
       subgroup.hetstat = TRUE)
dev.off()

# Test for subgroup differences
cat("\n=== SUBGROUP ANALYSIS ===\n\n")
cat(sprintf("Test for subgroup differences:\n"))
cat(sprintf("  Q = %.2f, df = %d, p = %.4f\n",
            ma_sub$Q.b.random, ma_sub$df.Q.b, ma_sub$pval.Q.b.random))

# Within-subgroup heterogeneity
for (sg in unique(data${{SUBGROUP}})) {
  ma_sg <- subset(ma_sub, subgroup == sg)
  cat(sprintf("\n%s (k = %d):\n", sg, ma_sg$k))
  cat(sprintf("  Effect: %.2f [%.2f, %.2f]\n",
              exp(ma_sg$TE.random), exp(ma_sg$lower.random), exp(ma_sg$upper.random)))
  cat(sprintf("  I² = %.1f%%\n", ma_sg$I2 * 100))
}
```

## Common Issues & Solutions

### Missing SDs
If SDs are not reported, estimate from:
- SE: SD = SE × √n
- 95% CI: SD = (upper - lower) × √n / 3.92
- IQR: SD ≈ IQR / 1.35
- Range: SD ≈ Range / 4

### Zero Events
Add continuity correction:
```r
metabin(..., incr = 0.5, method.incr = "only0")
```

### Median/IQR Data
Convert using Wan et al. (2014) method:
```r
library(estmeansd)
bc.mean.sd(q1.val = Q1, med.val = median, q3.val = Q3, n = n)
```

### Hazard Ratios
If only HR and CI reported:
```r
log_hr <- log(hr)
se <- (log(ci_upper) - log(ci_lower)) / 3.92
```

## GRADE Integration

After analysis, assess certainty:

1. **Risk of bias**: Overall from RoB assessment
2. **Inconsistency**: Based on I² and prediction interval
3. **Indirectness**: Population, intervention, outcome match
4. **Imprecision**: CI crosses clinical threshold or wide
5. **Publication bias**: Funnel asymmetry, trim-and-fill impact

Generate Summary of Findings table with absolute effects.
