---
name: data-extraction
version: 1.0.0
description: Extract structured data from neurosurgical studies
author: NeuroResearch Agent
license: MIT

triggers:
  - pattern: "extract.*data"
  - pattern: "data extraction"
  - pattern: "extraction form"
  - pattern: "pull.*from.*study"
  - pattern: "extract.*PDF"

requires:
  - filesystem

tools:
  - name: create_extraction_form
    description: Generate extraction form template
  - name: extract_from_pdf
    description: Extract data from PDF study
  - name: validate_extraction
    description: Validate extracted data
  - name: compile_extractions
    description: Compile extractions into pooled dataset

schemas:
  study_characteristics:
    study_id: string
    title: string
    authors: array
    year: integer
    journal: string
    country: string
    study_design: enum[RCT, prospective_cohort, retrospective_cohort, case_control, case_series]
    multicenter: boolean
    registration: string
    
  population:
    total_n: integer
    intervention_n: integer
    control_n: integer
    age_mean: number
    age_sd: number
    male_percent: number
    diagnosis: string
    severity: string
    
  intervention:
    name: string
    type: enum[surgical, medical, device, combination]
    details: string
    timing: string
    
  outcomes:
    binary:
      events_int: integer
      n_int: integer
      events_ctrl: integer
      n_ctrl: integer
    continuous:
      mean_int: number
      sd_int: number
      n_int: integer
      mean_ctrl: number
      sd_ctrl: number
      n_ctrl: integer
---

# Data Extraction Skill

## Overview

Systematic extraction of quantitative and qualitative data from neurosurgical studies following standardized schemas.

## Extraction Workflow

### Step 1: Study Identification
```yaml
study_id: FirstAuthor_Year
title: Full title of the study
authors:
  - First Author
  - Second Author
  - et al.
year: 2023
journal: Journal of Neurosurgery
doi: 10.3171/...
pmid: 12345678
country: USA
institution: Mayo Clinic
```

### Step 2: Study Design
```yaml
study_design: retrospective_cohort  # RCT, prospective_cohort, retrospective_cohort, case_control, case_series
multicenter: false
centers_n: 1
study_period:
  start: 2010-01-01
  end: 2020-12-31
registration: NCT00000000  # if applicable
funding: NIH Grant R01...
conflicts: None declared
```

### Step 3: Population
```yaml
population:
  total_n: 150
  intervention_n: 75
  control_n: 75
  
  demographics:
    age:
      mean: 62.5
      sd: 12.3
      median: 63
      range: [35, 85]
    sex:
      male_n: 90
      male_percent: 60
      
  diagnosis:
    condition: Malignant MCA infarction
    subtype: Right-sided
    severity_scale: NIHSS
    severity_mean: 18.5
    severity_sd: 4.2
    
  comorbidities:
    hypertension_percent: 65
    diabetes_percent: 28
    smoking_percent: 35
    previous_stroke_percent: 12
    
  inclusion_criteria:
    - Age 18-80 years
    - MCA infarction >50% territory
    - NIHSS ≥15
    - Symptom onset <48 hours
    
  exclusion_criteria:
    - Bilateral infarction
    - Pre-existing mRS >2
    - Coagulopathy
    - Terminal illness
```

### Step 4: Intervention & Comparator
```yaml
intervention:
  name: Decompressive craniectomy
  type: surgical
  approach: Frontotemporal
  technique: Standard hemicraniectomy ≥12cm diameter
  timing: <48 hours from symptom onset
  additional_procedures:
    - Duroplasty
    - EVD placement
  surgeon_experience: Senior neurosurgeons
  
comparator:
  name: Best medical therapy
  type: standard_care
  details: |
    - ICP monitoring
    - Osmotic therapy (mannitol, hypertonic saline)
    - Head elevation 30°
    - Sedation as needed
    - Blood pressure management
```

### Step 5: Outcomes
```yaml
outcomes:
  primary:
    - name: Mortality
      definition: Death from any cause
      type: binary
      timepoint: 6 months
      intervention:
        events: 15
        total: 75
        percent: 20.0
      control:
        events: 30
        total: 75
        percent: 40.0
      effect:
        measure: OR
        estimate: 0.38
        ci_lower: 0.18
        ci_upper: 0.79
        p_value: 0.009
        
    - name: Favorable outcome
      definition: mRS 0-3
      type: binary
      timepoint: 12 months
      intervention:
        events: 45
        total: 75
      control:
        events: 28
        total: 75
        
  secondary:
    - name: mRS score
      definition: Modified Rankin Scale
      type: continuous
      timepoint: 6 months
      intervention:
        n: 60
        mean: 3.2
        sd: 1.4
        median: 3
        iqr: [2, 4]
      control:
        n: 45
        mean: 4.1
        sd: 1.2
        
    - name: Length of ICU stay
      type: continuous
      unit: days
      intervention:
        n: 75
        median: 12
        iqr: [8, 18]
      control:
        n: 75
        median: 10
        iqr: [7, 15]
        
  adverse_events:
    - name: Surgical site infection
      intervention_n: 3
      intervention_percent: 4.0
    - name: Hydrocephalus requiring shunt
      intervention_n: 8
      intervention_percent: 10.7
```

### Step 6: Follow-up
```yaml
follow_up:
  duration_months: 12
  timepoints: [1, 3, 6, 12]
  method: Clinic visit and phone
  assessor_blinding: false
  completeness_percent: 88
  loss_to_followup:
    n: 18
    reasons:
      - Death: 12
      - Withdrew: 4
      - Lost contact: 2
```

### Step 7: Quality Assessment
```yaml
quality:
  tool: Newcastle-Ottawa Scale
  
  selection:
    representativeness: 1  # 0 or 1
    selection_non_exposed: 1
    ascertainment_exposure: 1
    outcome_not_present: 1
    
  comparability:
    main_factor: 1  # Age
    additional_factor: 1  # Baseline NIHSS
    
  outcome:
    assessment: 1  # Blinded
    follow_up_length: 1  # ≥6 months
    follow_up_adequacy: 1  # >80%
    
  total_stars: 8
  quality_rating: Good  # Good (7-9), Fair (4-6), Poor (0-3)
```

## Effect Size Calculations

### Binary Outcomes

```r
# From 2x2 table
calc_or <- function(a, b, c, d) {
  # a=events_int, b=non-events_int, c=events_ctrl, d=non-events_ctrl
  or <- (a * d) / (b * c)
  se_log <- sqrt(1/a + 1/b + 1/c + 1/d)
  ci_lower <- exp(log(or) - 1.96 * se_log)
  ci_upper <- exp(log(or) + 1.96 * se_log)
  list(or=or, ci_lower=ci_lower, ci_upper=ci_upper, se_log=se_log)
}

# From events and totals
a <- events_int
b <- n_int - events_int
c <- events_ctrl
d <- n_ctrl - events_ctrl
result <- calc_or(a, b, c, d)
```

### Continuous Outcomes

```r
library(esc)

# Standardized mean difference (Hedges' g)
esc_mean_sd(
  grp1m = mean_int, grp1sd = sd_int, grp1n = n_int,
  grp2m = mean_ctrl, grp2sd = sd_ctrl, grp2n = n_ctrl,
  es.type = "g"
)

# Mean difference
md <- mean_int - mean_ctrl
se_md <- sqrt(sd_int^2/n_int + sd_ctrl^2/n_ctrl)
```

### Median/IQR to Mean/SD

```r
# Wan et al. 2014 method
median_iqr_to_mean_sd <- function(median, q1, q3, n) {
  mean_est <- (q1 + median + q3) / 3
  sd_est <- (q3 - q1) / 1.35
  list(mean = mean_est, sd = sd_est)
}

# Hozo et al. 2005 for median + range
median_range_to_mean_sd <- function(median, min, max, n) {
  mean_est <- (min + 2*median + max) / 4
  sd_est <- (max - min) / 4
  list(mean = mean_est, sd = sd_est)
}
```

## Validation Rules

### Required Fields
- study_id
- year
- study_design
- population.total_n
- intervention.name
- At least one primary outcome

### Logical Checks
1. `events ≤ total` for all binary outcomes
2. `intervention_n + control_n ≤ total_n`
3. `0 ≤ percentages ≤ 100`
4. `ci_lower < estimate < ci_upper`
5. `sd > 0` for continuous outcomes

### Warnings
- Missing age data
- Missing follow-up completeness
- Single-arm study (no comparator)
- Very short follow-up (<3 months)

## Compiling to Pooled Dataset

```r
compile_binary <- function(extraction_dir) {
  files <- list.files(extraction_dir, pattern = "\\.yaml$", full.names = TRUE)
  
  rows <- list()
  for (f in files) {
    data <- yaml::read_yaml(f)
    
    for (outcome in data$outcomes$primary) {
      if (outcome$type == "binary") {
        rows[[length(rows) + 1]] <- data.frame(
          study = data$study_id,
          year = data$year,
          outcome = outcome$name,
          events_int = outcome$intervention$events,
          n_int = outcome$intervention$total,
          events_ctrl = outcome$control$events,
          n_ctrl = outcome$control$total
        )
      }
    }
  }
  
  do.call(rbind, rows)
}

# Save pooled data
pooled <- compile_binary("extractions/")
write.csv(pooled, "extractions/pooled_binary.csv", row.names = FALSE)
```
