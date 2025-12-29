---
name: risk-of-bias
version: 1.0.0
description: Risk of bias and quality assessment for systematic reviews
author: NeuroResearch Agent
license: MIT

triggers:
  - pattern: "risk of bias"
  - pattern: "RoB"
  - pattern: "quality assessment"
  - pattern: "Newcastle.Ottawa"
  - pattern: "ROBINS"
  - pattern: "bias assessment"

requires:
  - r-execute
  - filesystem

tools:
  - name: assess_rob2
    description: RoB 2 assessment for RCTs
  - name: assess_nos
    description: Newcastle-Ottawa Scale for cohort/case-control
  - name: assess_robins_i
    description: ROBINS-I for non-randomized interventions
  - name: generate_rob_plots
    description: Generate traffic light and summary plots
---

# Risk of Bias Assessment Skill

## Tool Selection Guide

| Study Design | Tool | Score Range |
|--------------|------|-------------|
| RCT | RoB 2 | Low / Some concerns / High |
| Cohort | Newcastle-Ottawa Scale | 0-9 stars |
| Case-control | Newcastle-Ottawa Scale | 0-9 stars |
| Non-randomized intervention | ROBINS-I | Low to Critical |
| Diagnostic accuracy | QUADAS-2 | Low / High / Unclear |
| Case series | JBI Checklist | Yes / No / Unclear |

---

## RoB 2 (Cochrane Risk of Bias 2.0)

### For Randomized Controlled Trials

```yaml
rob2_assessment:
  study_id: Smith_2020
  
  domain1_randomization:
    question_1_1: "Was the allocation sequence random?"
    response_1_1: "Yes"  # Y, PY, PN, N, NI
    question_1_2: "Was the allocation sequence concealed?"
    response_1_2: "Probably yes"
    question_1_3: "Baseline differences suggest problem with randomization?"
    response_1_3: "No"
    judgment: "Low risk"  # Low, Some concerns, High
    support: "Computer-generated sequence, sealed envelopes"
    
  domain2_deviations:
    question_2_1: "Were participants aware of assignment?"
    response_2_1: "Yes"  # Surgical trial, blinding not possible
    question_2_2: "Were carers aware of assignment?"
    response_2_2: "Yes"
    question_2_3: "Deviations from intended intervention?"
    response_2_3: "No"
    question_2_4: "Analysis appropriate for deviations?"
    response_2_4: "Not applicable"
    judgment: "Some concerns"
    support: "Open-label due to nature of intervention"
    
  domain3_missing_data:
    question_3_1: "Outcome data available for all participants?"
    response_3_1: "Probably yes"
    question_3_2: "Evidence outcome not biased by missing data?"
    response_3_2: "Yes"
    question_3_3: "Missingness depend on true value?"
    response_3_3: "Probably no"
    judgment: "Low risk"
    support: "95% follow-up, missing equally distributed"
    
  domain4_measurement:
    question_4_1: "Was outcome measurement appropriate?"
    response_4_1: "Yes"
    question_4_2: "Did measurement differ between groups?"
    response_4_2: "No"
    question_4_3: "Were assessors aware of assignment?"
    response_4_3: "No"
    question_4_4: "Could assessment be influenced by knowledge?"
    response_4_4: "No"
    judgment: "Low risk"
    support: "mRS assessed by blinded neurologist"
    
  domain5_selection:
    question_5_1: "Were data selected from multiple analyses?"
    response_5_1: "No"
    question_5_2: "Were multiple measurements available?"
    response_5_2: "No"
    question_5_3: "Could selection have been influenced by results?"
    response_5_3: "No"
    judgment: "Low risk"
    support: "Pre-registered primary outcome at 6 months"
    
  overall:
    judgment: "Some concerns"
    direction: "Favors experimental"  # or control, unpredictable
    rationale: "Open-label design unavoidable for surgical intervention"
```

### RoB 2 Data Format for robvis

```csv
Study,D1,D2,D3,D4,D5,Overall
Smith 2020,Low,Some concerns,Low,Low,Low,Some concerns
Jones 2021,Low,Low,Low,Low,Low,Low
Brown 2022,High,Some concerns,Low,High,Low,High
Lee 2023,Low,Low,Low,Low,Some concerns,Some concerns
```

---

## Newcastle-Ottawa Scale

### For Cohort Studies

```yaml
nos_cohort:
  study_id: Martinez_2022
  
  selection:  # Max 4 stars
    representativeness:
      question: "Representativeness of exposed cohort"
      options:
        a: "Truly representative (★)"
        b: "Somewhat representative (★)"
        c: "Selected group"
        d: "No description"
      selected: "a"
      stars: 1
      
    selection_non_exposed:
      question: "Selection of non-exposed cohort"
      options:
        a: "From same community (★)"
        b: "From different source"
        c: "No description"
      selected: "a"
      stars: 1
      
    ascertainment_exposure:
      question: "Ascertainment of exposure"
      options:
        a: "Secure record (★)"
        b: "Structured interview (★)"
        c: "Written self-report"
        d: "No description"
      selected: "a"
      stars: 1
      
    outcome_not_present:
      question: "Outcome not present at start"
      options:
        a: "Yes (★)"
        b: "No"
      selected: "a"
      stars: 1
      
  comparability:  # Max 2 stars
    main_factor:
      question: "Comparability based on design/analysis"
      control_for: "Age"
      stars: 1
      
    additional_factor:
      question: "Additional factor controlled"
      control_for: "Baseline severity (NIHSS)"
      stars: 1
      
  outcome:  # Max 3 stars
    assessment:
      question: "Assessment of outcome"
      options:
        a: "Independent blind assessment (★)"
        b: "Record linkage (★)"
        c: "Self-report"
        d: "No description"
      selected: "a"
      stars: 1
      
    follow_up_length:
      question: "Follow-up long enough for outcome"
      threshold: "≥6 months"
      adequate: true
      stars: 1
      
    follow_up_adequacy:
      question: "Adequacy of follow-up"
      options:
        a: "Complete follow-up (★)"
        b: ">80% with description of lost (★)"
        c: "Follow-up <80%"
        d: "No statement"
      selected: "b"
      stars: 1
      
  total_stars: 9
  quality_rating: "Good"  # Good: 7-9, Fair: 4-6, Poor: 0-3
```

### NOS Data Format

```csv
Study,S1,S2,S3,S4,C1,C2,O1,O2,O3,Total,Quality
Martinez 2022,1,1,1,1,1,1,1,1,1,9,Good
Kim 2021,1,1,1,1,1,0,1,1,0,7,Good
Wilson 2020,1,0,1,1,1,1,0,1,1,7,Good
Chen 2019,0,1,1,0,1,0,1,1,1,6,Fair
```

---

## ROBINS-I

### For Non-Randomized Studies of Interventions

```yaml
robins_i:
  study_id: Thompson_2023
  
  pre_intervention:
    domain1_confounding:
      question: "Bias due to confounding"
      considerations:
        - "Was there potential for confounding?"
        - "Did authors use appropriate analysis?"
        - "Were confounders measured and adjusted?"
      judgment: "Moderate"
      support: "Propensity score matching used, but unmeasured confounders possible"
      
    domain2_selection:
      question: "Bias in selection of participants"
      considerations:
        - "Selection related to intervention AND outcome?"
        - "Start of follow-up coincides with intervention start?"
      judgment: "Low"
      support: "All consecutive patients included from defined start date"
      
  at_intervention:
    domain3_classification:
      question: "Bias in classification of interventions"
      considerations:
        - "Intervention status well defined?"
        - "Classification affected by outcome knowledge?"
      judgment: "Low"
      support: "Surgical vs. medical clearly distinguished"
      
  post_intervention:
    domain4_deviations:
      question: "Bias due to deviations from intended interventions"
      considerations:
        - "Were there deviations from intended intervention?"
        - "Were deviations balanced between groups?"
      judgment: "Low"
      support: "Protocol-driven care in both groups"
      
    domain5_missing_data:
      question: "Bias due to missing data"
      considerations:
        - "Were outcome data reasonably complete?"
        - "Were participants excluded due to missing data?"
      judgment: "Low"
      support: "Complete outcome data for 94% of participants"
      
    domain6_measurement:
      question: "Bias in measurement of outcomes"
      considerations:
        - "Could measurement differ between groups?"
        - "Were assessors aware of intervention?"
      judgment: "Moderate"
      support: "Outcome assessors not formally blinded"
      
    domain7_selection_reporting:
      question: "Bias in selection of reported result"
      considerations:
        - "Multiple analyses possible?"
        - "Result selected from multiple measurements?"
      judgment: "Low"
      support: "Pre-specified primary outcome reported"
      
  overall:
    judgment: "Moderate"
    rationale: "Some concerns about confounding and outcome measurement"
```

### ROBINS-I Data Format

```csv
Study,D1,D2,D3,D4,D5,D6,D7,Overall
Thompson 2023,Moderate,Low,Low,Low,Low,Moderate,Low,Moderate
Garcia 2022,Serious,Low,Low,Low,Moderate,Moderate,Low,Serious
Ahmed 2021,Low,Low,Low,Low,Low,Low,Low,Low
```

---

## R Code for Visualization

### Generate All Plots

```r
library(robvis)
library(ggplot2)

# ============================================
# ROB 2 VISUALIZATION
# ============================================

rob2_data <- read.csv("quality_assessment/rob2_data.csv")

# Traffic light plot
rob2_traffic <- rob_traffic_light(
  data = rob2_data,
  tool = "ROB2",
  colour = "cochrane",
  psize = 10
)

ggsave("figures/rob2_traffic_light.png", rob2_traffic, 
       width = 12, height = nrow(rob2_data) * 0.5 + 2, dpi = 300)

# Summary plot
rob2_summary <- rob_summary(
  data = rob2_data,
  tool = "ROB2",
  overall = TRUE,
  colour = "cochrane"
)

ggsave("figures/rob2_summary.png", rob2_summary, 
       width = 10, height = 6, dpi = 300)

# ============================================
# ROBINS-I VISUALIZATION
# ============================================

robins_data <- read.csv("quality_assessment/robins_data.csv")

robins_traffic <- rob_traffic_light(
  data = robins_data,
  tool = "ROBINS-I",
  colour = "cochrane"
)

ggsave("figures/robins_traffic_light.png", robins_traffic,
       width = 14, height = nrow(robins_data) * 0.5 + 2, dpi = 300)

# ============================================
# NEWCASTLE-OTTAWA VISUALIZATION
# ============================================

nos_data <- read.csv("quality_assessment/nos_data.csv")

# Custom bar chart
nos_plot <- ggplot(nos_data, aes(x = reorder(Study, Total), y = Total)) +
  geom_col(aes(fill = Quality), width = 0.7) +
  geom_hline(yintercept = c(4, 7), linetype = "dashed", alpha = 0.5) +
  geom_text(aes(label = Total), hjust = -0.3, size = 4) +
  coord_flip() +
  scale_fill_manual(
    values = c("Good" = "#4CAF50", "Fair" = "#FFC107", "Poor" = "#F44336"),
    name = "Quality"
  ) +
  scale_y_continuous(limits = c(0, 10), breaks = 0:9) +
  labs(
    x = "",
    y = "Newcastle-Ottawa Scale Score",
    title = "Risk of Bias: Newcastle-Ottawa Scale",
    subtitle = "Good: 7-9 stars | Fair: 4-6 stars | Poor: 0-3 stars"
  ) +
  theme_minimal() +
  theme(
    legend.position = "bottom",
    panel.grid.major.y = element_blank(),
    axis.text.y = element_text(size = 11)
  )

ggsave("figures/nos_scores.png", nos_plot, 
       width = 10, height = max(6, nrow(nos_data) * 0.4), dpi = 300)

# Stacked bar by domain
nos_long <- nos_data %>%
  tidyr::pivot_longer(
    cols = c(S1, S2, S3, S4, C1, C2, O1, O2, O3),
    names_to = "Domain",
    values_to = "Stars"
  ) %>%
  mutate(
    Category = case_when(
      Domain %in% c("S1", "S2", "S3", "S4") ~ "Selection",
      Domain %in% c("C1", "C2") ~ "Comparability",
      TRUE ~ "Outcome"
    )
  )

nos_stacked <- ggplot(nos_long, aes(x = Study, y = Stars, fill = Category)) +
  geom_col() +
  coord_flip() +
  scale_fill_brewer(palette = "Set2") +
  labs(x = "", y = "Stars", title = "NOS by Domain") +
  theme_minimal()

ggsave("figures/nos_domains.png", nos_stacked, 
       width = 10, height = 6, dpi = 300)
```

### Weighted Analysis by Quality

```r
# Weight meta-analysis by study quality
library(meta)

# Add quality weights
data <- merge(pooled_data, nos_data[, c("Study", "Total")], 
              by.x = "study", by.y = "Study")

# Quality-adjusted analysis
ma_weighted <- metabin(
  event.e = events_int,
  n.e = n_int,
  event.c = events_ctrl,
  n.c = n_ctrl,
  studlab = study,
  data = data,
  sm = "OR",
  random = TRUE,
  # Use quality score as additional weight
  byvar = ifelse(data$Total >= 7, "High quality", "Lower quality")
)

# Sensitivity: exclude low-quality studies
ma_high_quality <- metabin(
  event.e = events_int,
  n.e = n_int,
  event.c = events_ctrl,
  n.c = n_ctrl,
  studlab = study,
  data = subset(data, Total >= 7),
  sm = "OR",
  random = TRUE
)
```
