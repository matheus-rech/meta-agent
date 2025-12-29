---
name: manuscript-writing
version: 1.0.0
description: PRISMA-compliant manuscript drafting for systematic reviews
author: NeuroResearch Agent
license: MIT

triggers:
  - pattern: "write.*manuscript"
  - pattern: "draft.*section"
  - pattern: "PRISMA"
  - pattern: "methods section"
  - pattern: "results section"
  - pattern: "discussion"
  - pattern: "abstract"

requires:
  - filesystem

outputs:
  - manuscript/*.md
  - manuscript/*.docx
---

# Manuscript Writing Skill

## Overview

This skill generates PRISMA 2020-compliant manuscript sections for systematic reviews and meta-analyses. It follows best practices for medical research reporting.

## PRISMA 2020 Checklist Integration

Each section addresses specific PRISMA items:

### Title (Item 1)
- Identify as systematic review, meta-analysis, or both
- Include key population, intervention, and comparison

### Abstract (Item 2)
Structured abstract with:
- Background/Objectives
- Methods (eligibility, data sources, risk of bias)
- Results (studies included, synthesized results)
- Conclusions
- Registration (PROSPERO)

### Introduction
- Item 3: Rationale (what is known, knowledge gap)
- Item 4: Objectives (PICO, specific aims)

### Methods
- Item 5: Protocol and registration
- Item 6: Eligibility criteria (PICO format)
- Item 7: Information sources
- Item 8: Search strategy
- Item 9: Selection process
- Item 10: Data collection process
- Item 11: Data items
- Item 12: Risk of bias assessment
- Item 13: Effect measures
- Item 14: Synthesis methods
- Item 15: Reporting bias assessment
- Item 16: Certainty assessment (GRADE)

### Results
- Item 17: Study selection (PRISMA flow)
- Item 18: Study characteristics
- Item 19: Risk of bias in studies
- Item 20: Results of individual studies
- Item 21: Results of syntheses
- Item 22: Reporting biases
- Item 23: Certainty of evidence

### Discussion
- Item 24: Discussion of evidence
- Item 25: Limitations
- Item 26: Conclusions

## Section Templates

### Abstract Template

```markdown
## Abstract

**Background:** [Disease burden, current treatment landscape, knowledge gap]

**Objectives:** To systematically review and meta-analyze [intervention] compared to [comparator] for [population] regarding [primary outcome].

**Methods:** We searched PubMed, Embase, and Cochrane CENTRAL from inception to [month year]. [Study designs] comparing [intervention] to [comparator] in [population] were included. Primary outcome was [outcome]. Risk of bias was assessed using [tool]. Random-effects meta-analysis was performed.

**Results:** [N] studies ([N] participants) were included. [Intervention] was associated with [direction] [outcome] compared to [comparator] (OR/RR/MD [estimate], 95% CI [lower]–[upper]; I² = [value]%). [Secondary findings]. Certainty of evidence was [GRADE level].

**Conclusions:** [Main finding and clinical implication]. [Limitations]. [Future research needs].

**Registration:** PROSPERO [number]

**Keywords:** [5-7 MeSH terms]
```

### Introduction Template

```markdown
## Introduction

[Opening statement about disease/condition burden and significance]

[Current treatment landscape - established interventions]

[Knowledge gap - what is unknown or debated]

[Why a systematic review is needed - prior reviews limitations, new evidence]

**Objective:** To systematically review and meta-analyze the evidence comparing [intervention] to [comparator] for [outcome] in patients with [condition].

Specifically, we aimed to:
1. Evaluate the effect of [intervention] on [primary outcome]
2. Assess [secondary outcomes]
3. Explore sources of heterogeneity through [subgroup/meta-regression]
4. Evaluate the certainty of evidence using GRADE
```

### Methods Template

```markdown
## Methods

### Protocol and Registration

This systematic review was conducted following the Preferred Reporting Items for Systematic Reviews and Meta-Analyses (PRISMA) 2020 guidelines. The protocol was registered prospectively in PROSPERO (CRD[number]) on [date].

### Eligibility Criteria

**Population:** Adult patients (≥18 years) with [condition] confirmed by [diagnostic criteria].

**Intervention:** [Detailed intervention description including technique, timing, duration]

**Comparator:** [Comparator description - active treatment, placebo, standard care, no intervention]

**Outcomes:**
- *Primary*: [Primary outcome with definition and timing]
- *Secondary*: [List secondary outcomes]

**Study design:** Randomized controlled trials and comparative observational studies (prospective and retrospective cohorts). Case series, case reports, reviews, and non-comparative studies were excluded.

### Information Sources

We searched the following databases from inception to [month day, year]:
- PubMed/MEDLINE
- Embase (via Ovid)
- Cochrane Central Register of Controlled Trials (CENTRAL)
- [Additional databases as applicable]

Reference lists of included studies and relevant reviews were hand-searched. ClinicalTrials.gov and WHO ICTRP were searched for ongoing or unpublished studies.

### Search Strategy

The search strategy was developed with a medical librarian and combined terms for [condition], [intervention], and [comparator]. No language or date restrictions were applied. The complete search strategy is provided in Supplementary Table S1.

### Selection Process

Two reviewers ([initials]) independently screened titles and abstracts using [software]. Full texts of potentially eligible studies were retrieved and assessed against inclusion criteria. Disagreements were resolved by discussion or consultation with a third reviewer ([initials]). Inter-rater reliability was assessed using Cohen's kappa.

### Data Collection Process

Data were extracted independently by two reviewers using a standardized form. Extracted data included:
- Study characteristics (design, setting, country, sample size)
- Population (demographics, disease severity, comorbidities)
- Intervention and comparator details
- Outcome definitions and results
- Risk of bias assessment

Authors were contacted for missing or unclear data.

### Data Items

**Outcomes:** [Define each outcome precisely]
- [Primary outcome]: [Definition, measurement tool, timing, assessor blinding]
- [Secondary outcomes]: [As above]

### Risk of Bias Assessment

Risk of bias was assessed using [tool] by two independent reviewers. [Brief description of tool domains]. Overall risk of bias was classified as [categories]. Discrepancies were resolved by consensus.

### Effect Measures

For binary outcomes, odds ratios (OR) or risk ratios (RR) with 95% confidence intervals were used. For continuous outcomes, mean differences (MD) or standardized mean differences (SMD) were calculated. For time-to-event outcomes, hazard ratios (HR) were used.

### Synthesis Methods

Meta-analysis was performed when ≥2 studies reported the same outcome with comparable methods. Random-effects models (DerSimonian-Laird) were used given expected clinical heterogeneity. Statistical heterogeneity was assessed using I² statistic and Cochran's Q test.

Subgroup analyses were planned a priori for:
- [Subgroup variable 1]
- [Subgroup variable 2]

Sensitivity analyses included:
- Excluding high risk of bias studies
- [Other planned sensitivity analyses]

Publication bias was assessed visually using funnel plots and statistically using [Egger's/Peters' test] when ≥10 studies were available.

All analyses were performed using R (version [X]) with the meta and metafor packages.

### Certainty Assessment

The certainty of evidence was assessed using the Grading of Recommendations Assessment, Development and Evaluation (GRADE) approach for each outcome. Evidence was rated as high, moderate, low, or very low based on risk of bias, inconsistency, indirectness, imprecision, and publication bias.
```

### Results Template

```markdown
## Results

### Study Selection

The search identified [N] records after removing duplicates. After title and abstract screening, [N] full-text articles were assessed for eligibility. [N] studies met inclusion criteria and were included in the qualitative synthesis, of which [N] were included in the meta-analysis. The study selection process is shown in Figure 1.

[PRISMA flow diagram reference]

### Study Characteristics

The [N] included studies were published between [year] and [year]. Studies were conducted in [countries]. [N] were randomized controlled trials and [N] were observational studies.

A total of [N] patients were included ([N] in intervention group, [N] in comparator group). Mean age ranged from [X] to [Y] years, and [X]% were male.

[Table 1: Characteristics of included studies]

### Risk of Bias

Among RCTs, [N] were at low risk, [N] at some concerns, and [N] at high risk of bias. The main concerns were [domains]. Among observational studies, [N] were rated as good quality (NOS ≥7), [N] as fair (NOS 5-6), and [N] as poor (NOS <5).

[Figure 2: Risk of bias summary]

### Primary Outcome: [Outcome Name]

[N] studies ([N] participants) reported [outcome]. [Intervention] was associated with [significantly/non-significantly] [higher/lower] [outcome] compared to [comparator] (OR [X.XX], 95% CI [X.XX–X.XX]; p = [value]; I² = [X]%; Figure 3).

The prediction interval ranged from [X.XX] to [X.XX], suggesting [interpretation].

[Figure 3: Forest plot for primary outcome]

**Subgroup analyses:** [Describe subgroup findings with test for interaction]

**Sensitivity analyses:** Excluding high-risk studies yielded similar results (OR [X.XX], 95% CI [X.XX–X.XX]). [Other sensitivity analyses]

### Secondary Outcomes

**[Outcome 2]:** [N] studies ([N] participants) reported [outcome]. [Results statement] (OR/MD [estimate], 95% CI [range]; I² = [X]%).

**[Outcome 3]:** [Similar structure]

[Additional secondary outcomes]

### Publication Bias

Visual inspection of the funnel plot showed [symmetry/asymmetry]. [Statistical test] [was/was not] significant (p = [value]), suggesting [interpretation].

[Figure 4: Funnel plot]

### Certainty of Evidence

The certainty of evidence ranged from [very low to high] across outcomes. For the primary outcome, certainty was rated as [level] due to [reasons for downgrading/upgrading].

[Summary of findings table reference]
```

### Discussion Template

```markdown
## Discussion

### Summary of Evidence

This systematic review and meta-analysis of [N] studies including [N] patients found that [intervention] compared to [comparator] was associated with [main finding for primary outcome]. [Key secondary findings]. The certainty of evidence was [GRADE level].

### Comparison with Previous Reviews

[Compare findings to prior systematic reviews/meta-analyses. Explain similarities/differences and potential reasons]

### Strengths and Limitations

**Strengths:**
- Comprehensive search strategy across multiple databases
- Pre-registered protocol
- Dual independent screening and extraction
- [Study-specific strengths]

**Limitations:**
- [Limitation 1 with impact on interpretation]
- [Limitation 2]
- [Heterogeneity if substantial - sources explored]
- [Publication bias if detected]
- [Quality of included studies]

### Clinical Implications

[Based on findings, what should clinicians consider? When is intervention preferred? Patient selection?]

### Future Research

- [Specific research questions that remain unanswered]
- [Study designs needed]
- [Populations or outcomes to explore]

## Conclusions

[1-2 sentence summary of main finding and clinical implication]. [Statement about certainty/confidence]. [Call for additional research if warranted].
```

## Journal-Specific Formatting

### Journal of Neurosurgery
- Word limit: Abstract 275, Manuscript 4500
- Structured abstract: Object, Methods, Results, Conclusions
- British spelling
- References: Vancouver style, numbered

### Neurosurgery
- Word limit: Abstract 250, Manuscript 5000
- Structured abstract: Background, Objective, Methods, Results, Conclusion
- American spelling
- References: AMA style

### World Neurosurgery
- Word limit: Abstract 250, Manuscript 4000
- Highlights required (3-5 bullet points, 85 chars each)
- References: Vancouver style

## Writing Guidelines

1. **Use active voice** when possible
2. **Be precise** with numbers and statistics
3. **Avoid jargon** - define abbreviations
4. **Use consistent terminology** throughout
5. **Report effect sizes with confidence intervals**
6. **Interpret statistical vs clinical significance**
7. **Acknowledge limitations honestly**
8. **Cite primary sources** not secondary reviews

## Checklist Before Submission

- [ ] PRISMA checklist completed
- [ ] Protocol registration cited
- [ ] All PICO elements defined
- [ ] Search strategy reproducible
- [ ] Flow diagram matches numbers
- [ ] All included studies in tables
- [ ] Forest plots for all meta-analyses
- [ ] Heterogeneity interpreted
- [ ] Publication bias assessed
- [ ] GRADE assessment included
- [ ] Author contributions stated
- [ ] Conflicts of interest declared
- [ ] Data availability statement
- [ ] Supplementary materials prepared
