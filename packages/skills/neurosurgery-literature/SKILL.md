---
name: neurosurgery-literature
version: 1.0.0
description: Domain-specific literature search for neurosurgery systematic reviews
author: NeuroResearch Agent
license: MIT

triggers:
  - pattern: "search.*literature"
  - pattern: "find.*studies"
  - pattern: "pubmed"
  - pattern: "systematic search"
  - pattern: "PICO"
  - pattern: "search strategy"

requires:
  - pubmed-mcp

outputs:
  - searches/*.csv
  - searches/*.md
---

# Neurosurgery Literature Search Skill

## Overview

This skill provides domain-aware literature searching for neurosurgical systematic reviews. It understands neurosurgery subspecialties, common procedures, outcome measures, and builds optimized search strategies.

## Subspecialty Knowledge Base

### Vascular Neurosurgery
**Conditions:**
- Intracranial aneurysms (ruptured/unruptured, saccular/fusiform)
- Arteriovenous malformations (AVMs), dAVFs
- Cavernous malformations
- Moyamoya disease
- Ischemic stroke, hemorrhagic stroke
- Cerebral vasospasm, delayed cerebral ischemia

**Procedures:**
- Microsurgical clipping
- Endovascular coiling, flow diversion, WEB device
- Bypass surgery (EC-IC, STA-MCA, ELANA)
- Decompressive craniectomy/hemicraniectomy
- EVD placement, ICP monitoring

**MeSH Terms:**
```
"Intracranial Aneurysm"[MeSH]
"Arteriovenous Malformations"[MeSH]  
"Stroke"[MeSH]
"Subarachnoid Hemorrhage"[MeSH]
"Decompressive Craniectomy"[MeSH]
"Cerebral Revascularization"[MeSH]
```

**Outcomes:**
- mRS (modified Rankin Scale) 0-6
- GOS/GOS-E
- Mortality
- Rebleeding rate
- Vasospasm/DCI incidence
- Aneurysm occlusion rate

### Neuro-Oncology
**Conditions:**
- Gliomas (WHO Grade 1-4, IDH status, 1p19q)
- Glioblastoma multiforme (GBM)
- Meningiomas (WHO Grade 1-3)
- Pituitary adenomas (functioning/non-functioning)
- Vestibular schwannomas
- Brain metastases
- Skull base tumors

**Procedures:**
- Craniotomy for tumor resection
- Awake craniotomy with mapping
- Fluorescence-guided surgery (5-ALA)
- Laser interstitial thermal therapy (LITT)
- Stereotactic biopsy
- Transsphenoidal surgery
- Radiosurgery (Gamma Knife, CyberKnife)

**MeSH Terms:**
```
"Brain Neoplasms"[MeSH]
"Glioma"[MeSH]
"Glioblastoma"[MeSH]
"Meningioma"[MeSH]
"Pituitary Neoplasms"[MeSH]
"Neuroma, Acoustic"[MeSH]
```

**Outcomes:**
- Extent of resection (GTR, STR, biopsy)
- Progression-free survival (PFS)
- Overall survival (OS)
- KPS (Karnofsky Performance Status)
- Neurological function
- Seizure control (Engel class)
- Endocrine outcomes (for pituitary)

### Spine Surgery
**Conditions:**
- Degenerative disc disease
- Cervical/lumbar stenosis
- Spondylolisthesis
- Spinal deformity (scoliosis, kyphosis)
- Spinal trauma/fractures
- Spinal tumors
- Spinal infections

**Procedures:**
- ACDF (anterior cervical discectomy and fusion)
- Cervical disc arthroplasty
- Laminectomy, laminoplasty
- PLIF, TLIF, ALIF, LLIF, OLIF
- Pedicle screw fixation
- Corpectomy
- Minimally invasive spine surgery

**MeSH Terms:**
```
"Spinal Fusion"[MeSH]
"Diskectomy"[MeSH]
"Laminectomy"[MeSH]
"Spinal Stenosis"[MeSH]
"Spondylolisthesis"[MeSH]
"Intervertebral Disc Degeneration"[MeSH]
```

**Outcomes:**
- ODI (Oswestry Disability Index)
- NDI (Neck Disability Index)
- VAS (Visual Analog Scale) for pain
- JOA score (Japanese Orthopaedic Association)
- Fusion rate
- Adjacent segment disease
- Return to work

### Functional Neurosurgery
**Conditions:**
- Parkinson's disease
- Essential tremor
- Dystonia
- Epilepsy (drug-resistant)
- Chronic pain syndromes
- Trigeminal neuralgia
- Spasticity
- Psychiatric disorders (OCD, depression)

**Procedures:**
- Deep brain stimulation (DBS) - STN, GPi, VIM, ANT
- Radiofrequency lesioning
- Gamma Knife radiosurgery
- MR-guided focused ultrasound (MRgFUS)
- Epilepsy surgery (ATL, SAH, lesionectomy)
- Laser ablation (LITT)
- Spinal cord stimulation
- Intrathecal baclofen pump
- Vagus nerve stimulation

**MeSH Terms:**
```
"Deep Brain Stimulation"[MeSH]
"Epilepsy Surgery"[MeSH]
"Movement Disorders"[MeSH]
"Parkinson Disease"[MeSH]
"Trigeminal Neuralgia"[MeSH]
```

**Outcomes:**
- UPDRS (Unified Parkinson's Disease Rating Scale)
- Tremor rating scales
- Engel classification (epilepsy)
- Seizure freedom rate
- Pain NRS/VAS
- Quality of life (SF-36, PDQ-39)

### Pediatric Neurosurgery
**Conditions:**
- Hydrocephalus (congenital, acquired)
- Chiari malformation (Type I, II)
- Craniosynostosis
- Tethered cord syndrome
- Myelomeningocele/spina bifida
- Pediatric brain tumors
- Arachnoid cysts

**Procedures:**
- VP shunt, VA shunt
- Endoscopic third ventriculostomy (ETV)
- ETV with choroid plexus cauterization
- Chiari decompression
- Cranial vault remodeling
- Myelomeningocele repair
- Detethering

**MeSH Terms:**
```
"Hydrocephalus"[MeSH]
"Arnold-Chiari Malformation"[MeSH]
"Craniosynostoses"[MeSH]
"Myelomeningocele"[MeSH]
"Spinal Dysraphism"[MeSH]
```

**Outcomes:**
- Shunt revision rate
- ETV success score
- Developmental outcomes
- Cosmetic outcomes
- Neurological function

### Trauma
**Conditions:**
- Traumatic brain injury (mild/moderate/severe)
- Epidural hematoma (EDH)
- Subdural hematoma (acute/chronic SDH)
- Contusions, DAI
- Skull fractures
- Spinal trauma, SCI

**Procedures:**
- Craniotomy for hematoma evacuation
- Decompressive craniectomy
- ICP monitoring (EVD, bolt)
- Cranioplasty
- Spine fixation

**MeSH Terms:**
```
"Craniocerebral Trauma"[MeSH]
"Brain Injuries, Traumatic"[MeSH]
"Hematoma, Epidural, Cranial"[MeSH]
"Hematoma, Subdural"[MeSH]
"Spinal Cord Injuries"[MeSH]
"Intracranial Pressure"[MeSH]
```

**Outcomes:**
- GCS (Glasgow Coma Scale)
- GOS/GOS-E
- Mortality
- ICP control
- ASIA score (spinal)
- Functional independence

## Search Strategy Templates

### Basic PICO Search
```
# Population
("{{CONDITION}}"[MeSH] OR "{{CONDITION}}"[Title/Abstract])

# Intervention  
AND ("{{INTERVENTION}}"[MeSH] OR "{{INTERVENTION}}"[Title/Abstract])

# Comparator (optional)
AND ("{{COMPARATOR}}"[MeSH] OR "{{COMPARATOR}}"[Title/Abstract])

# Outcome (optional)
AND ("{{OUTCOME}}"[Title/Abstract])

# Filters
AND humans[MeSH] 
AND english[Language]
AND ("{{START_YEAR}}"[PDAT]:"{{END_YEAR}}"[PDAT])
```

### High-Quality Evidence Filter
```
AND (
  randomized controlled trial[pt] OR
  controlled clinical trial[pt] OR
  meta-analysis[pt] OR
  systematic review[pt] OR
  "comparative study"[pt]
)
```

### Neurosurgery Journal Filter
```
AND (
  "J Neurosurg"[Journal] OR
  "Neurosurgery"[Journal] OR
  "World Neurosurg"[Journal] OR
  "Acta Neurochir"[Journal] OR
  "J Neurotrauma"[Journal] OR
  "Spine"[Journal] OR
  "Eur Spine J"[Journal] OR
  "J Neurosurg Spine"[Journal] OR
  "J Neurosurg Pediatr"[Journal] OR
  "Stereotact Funct Neurosurg"[Journal] OR
  "Epilepsia"[Journal]
)
```

## Outcome Scales Quick Reference

| Scale | Full Name | Range | Better |
|-------|-----------|-------|--------|
| GCS | Glasgow Coma Scale | 3-15 | Higher |
| GOS | Glasgow Outcome Scale | 1-5 | Higher |
| GOS-E | GOS Extended | 1-8 | Higher |
| mRS | modified Rankin Scale | 0-6 | Lower |
| KPS | Karnofsky Performance Status | 0-100 | Higher |
| NIHSS | NIH Stroke Scale | 0-42 | Lower |
| ODI | Oswestry Disability Index | 0-100% | Lower |
| NDI | Neck Disability Index | 0-100% | Lower |
| VAS | Visual Analog Scale | 0-10 | Lower |
| Engel | Engel Epilepsy Classification | I-IV | Class I |
| UPDRS | Unified Parkinson's Rating | 0-199 | Lower |
| JOA | Japanese Ortho Association | 0-17 | Higher |
| ASIA | American Spinal Injury Assoc | A-E | E |

## Usage Examples

### Example 1: Vascular Search
```
User: Search for studies on clipping vs coiling for ruptured aneurysms

Search Strategy:
("Intracranial Aneurysm"[MeSH] OR "cerebral aneurysm"[tiab] OR 
 "intracranial aneurysm"[tiab]) 
AND ("Subarachnoid Hemorrhage"[MeSH] OR "rupture"[tiab] OR "ruptured"[tiab])
AND (
  ("Neurosurgical Procedures"[MeSH] OR "clipping"[tiab] OR 
   "microsurgical"[tiab] OR "craniotomy"[tiab])
  OR
  ("Endovascular Procedures"[MeSH] OR "coiling"[tiab] OR 
   "embolization"[tiab] OR "endovascular"[tiab])
)
AND (outcome*[tiab] OR mortality[tiab] OR "mRS"[tiab] OR 
     rebleed*[tiab] OR occlusion[tiab])
AND humans[MeSH] AND english[Language]
```

### Example 2: Spine Search
```
User: Find RCTs on ACDF vs arthroplasty for cervical disc disease

Search Strategy:
("Intervertebral Disc Degeneration"[MeSH] OR "cervical disc"[tiab] OR 
 "disc herniation"[tiab])
AND (
  ("Spinal Fusion"[MeSH] OR "ACDF"[tiab] OR 
   "anterior cervical discectomy"[tiab] OR "fusion"[tiab])
  OR
  ("Arthroplasty"[MeSH] OR "disc replacement"[tiab] OR 
   "disc arthroplasty"[tiab] OR "artificial disc"[tiab])
)
AND randomized controlled trial[pt]
AND humans[MeSH] AND english[Language]
```

## Best Practices

1. **Start broad, then narrow** - Begin with sensitive search, add specificity
2. **Use both MeSH and free text** - Capture indexed and recent articles
3. **Check for synonyms** - Different terms for same concept
4. **Document everything** - Save strategy with date for reproducibility
5. **Validate with known articles** - Ensure key studies are captured
6. **Consider grey literature** - ClinicalTrials.gov, conference abstracts
