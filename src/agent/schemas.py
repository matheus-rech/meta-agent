"""JSON Schemas for structured data extraction and validation."""

from typing import Any

# Schema for individual outcome data
OUTCOME_SCHEMA: dict[str, Any] = {
    "type": "object",
    "properties": {
        "name": {
            "type": "string",
            "description": "Name of the outcome (e.g., 'mortality', 'mRS 0-2')"
        },
        "type": {
            "type": "string",
            "enum": ["binary", "continuous", "time-to-event", "ordinal"],
            "description": "Type of outcome data"
        },
        "timepoint": {
            "type": "string",
            "description": "Follow-up timepoint (e.g., '30 days', '6 months')"
        },
        "intervention": {
            "type": "object",
            "properties": {
                "events": {"type": "integer", "minimum": 0},
                "total": {"type": "integer", "minimum": 1},
                "mean": {"type": "number"},
                "sd": {"type": "number", "minimum": 0},
                "median": {"type": "number"},
                "iqr": {
                    "type": "array",
                    "items": {"type": "number"},
                    "minItems": 2,
                    "maxItems": 2
                }
            }
        },
        "control": {
            "type": "object",
            "properties": {
                "events": {"type": "integer", "minimum": 0},
                "total": {"type": "integer", "minimum": 1},
                "mean": {"type": "number"},
                "sd": {"type": "number", "minimum": 0},
                "median": {"type": "number"},
                "iqr": {
                    "type": "array",
                    "items": {"type": "number"},
                    "minItems": 2,
                    "maxItems": 2
                }
            }
        },
        "effect_estimate": {
            "type": "object",
            "properties": {
                "measure": {
                    "type": "string",
                    "enum": ["OR", "RR", "HR", "MD", "SMD", "RD"]
                },
                "value": {"type": "number"},
                "ci_lower": {"type": "number"},
                "ci_upper": {"type": "number"},
                "p_value": {"type": "number", "minimum": 0, "maximum": 1}
            }
        }
    },
    "required": ["name", "type"]
}

# Schema for complete study extraction
EXTRACTION_SCHEMA: dict[str, Any] = {
    "type": "object",
    "properties": {
        "study_id": {
            "type": "string",
            "description": "Unique identifier in FirstAuthorYear format (e.g., 'Smith2023')"
        },
        "pmid": {
            "type": "string",
            "pattern": "^[0-9]+$",
            "description": "PubMed ID"
        },
        "doi": {
            "type": "string",
            "description": "Digital Object Identifier"
        },
        "title": {
            "type": "string",
            "description": "Full title of the study"
        },
        "year": {
            "type": "integer",
            "minimum": 1900,
            "maximum": 2100,
            "description": "Publication year"
        },
        "country": {
            "type": "string",
            "description": "Country where study was conducted"
        },
        "study_design": {
            "type": "string",
            "enum": [
                "RCT",
                "Prospective cohort",
                "Retrospective cohort",
                "Case-control",
                "Case series",
                "Cross-sectional"
            ],
            "description": "Study design classification"
        },
        "sample_size": {
            "type": "integer",
            "minimum": 1,
            "description": "Total number of participants"
        },
        "follow_up_months": {
            "type": "number",
            "minimum": 0,
            "description": "Mean or median follow-up duration in months"
        },
        "patient_demographics": {
            "type": "object",
            "properties": {
                "age_mean": {"type": "number", "minimum": 0},
                "age_sd": {"type": "number", "minimum": 0},
                "age_median": {"type": "number", "minimum": 0},
                "age_iqr": {
                    "type": "array",
                    "items": {"type": "number"},
                    "minItems": 2,
                    "maxItems": 2
                },
                "male_percent": {
                    "type": "number",
                    "minimum": 0,
                    "maximum": 100
                }
            },
            "description": "Patient demographic characteristics"
        },
        "intervention": {
            "type": "object",
            "properties": {
                "name": {"type": "string"},
                "type": {"type": "string"},
                "details": {"type": "string"}
            },
            "required": ["name"],
            "description": "Intervention or exposure details"
        },
        "comparator": {
            "type": "object",
            "properties": {
                "name": {"type": "string"},
                "type": {"type": "string"},
                "details": {"type": "string"}
            },
            "description": "Comparator or control group details"
        },
        "outcomes": {
            "type": "array",
            "items": OUTCOME_SCHEMA,
            "description": "List of outcome measures with data"
        },
        "risk_of_bias": {
            "type": "object",
            "properties": {
                "tool": {
                    "type": "string",
                    "enum": ["RoB2", "NOS", "ROBINS-I", "QUADAS-2"]
                },
                "overall": {
                    "type": "string",
                    "enum": ["Low", "Some concerns", "High"]
                },
                "domains": {
                    "type": "object",
                    "additionalProperties": {
                        "type": "string",
                        "enum": ["Low", "Some concerns", "High"]
                    }
                }
            },
            "description": "Risk of bias assessment"
        },
        "notes": {
            "type": "string",
            "description": "Additional notes or comments"
        }
    },
    "required": ["study_id", "year", "study_design", "sample_size"]
}

# Schema for meta-analysis results
META_ANALYSIS_SCHEMA: dict[str, Any] = {
    "type": "object",
    "properties": {
        "analysis_type": {
            "type": "string",
            "enum": ["binary", "continuous", "proportion", "network", "survival"],
            "description": "Type of meta-analysis performed"
        },
        "outcome": {
            "type": "string",
            "description": "Name of the outcome analyzed"
        },
        "n_studies": {
            "type": "integer",
            "minimum": 1,
            "description": "Number of studies included"
        },
        "n_participants": {
            "type": "integer",
            "minimum": 1,
            "description": "Total number of participants"
        },
        "effect_model": {
            "type": "string",
            "enum": ["fixed", "random"],
            "description": "Effect model used"
        },
        "pooled_effect": {
            "type": "object",
            "properties": {
                "measure": {
                    "type": "string",
                    "description": "Effect measure (OR, RR, MD, SMD, HR)"
                },
                "estimate": {"type": "number"},
                "ci_lower": {"type": "number"},
                "ci_upper": {"type": "number"},
                "p_value": {"type": "number", "minimum": 0, "maximum": 1}
            },
            "required": ["measure", "estimate", "ci_lower", "ci_upper"],
            "description": "Pooled effect estimate"
        },
        "heterogeneity": {
            "type": "object",
            "properties": {
                "i_squared": {
                    "type": "number",
                    "minimum": 0,
                    "maximum": 100,
                    "description": "I-squared statistic (%)"
                },
                "i_squared_ci_lower": {"type": "number", "minimum": 0, "maximum": 100},
                "i_squared_ci_upper": {"type": "number", "minimum": 0, "maximum": 100},
                "tau_squared": {
                    "type": "number",
                    "minimum": 0,
                    "description": "Between-study variance"
                },
                "q_statistic": {"type": "number", "minimum": 0},
                "q_df": {"type": "integer", "minimum": 0},
                "q_p_value": {"type": "number", "minimum": 0, "maximum": 1},
                "prediction_interval": {
                    "type": "array",
                    "items": {"type": "number"},
                    "minItems": 2,
                    "maxItems": 2
                }
            },
            "description": "Heterogeneity assessment"
        },
        "publication_bias": {
            "type": "object",
            "properties": {
                "egger_test": {
                    "type": "object",
                    "properties": {
                        "intercept": {"type": "number"},
                        "p_value": {"type": "number", "minimum": 0, "maximum": 1}
                    }
                },
                "begg_test": {
                    "type": "object",
                    "properties": {
                        "z": {"type": "number"},
                        "p_value": {"type": "number", "minimum": 0, "maximum": 1}
                    }
                },
                "trim_fill": {
                    "type": "object",
                    "properties": {
                        "studies_added": {"type": "integer", "minimum": 0},
                        "adjusted_estimate": {"type": "number"},
                        "adjusted_ci_lower": {"type": "number"},
                        "adjusted_ci_upper": {"type": "number"}
                    }
                }
            },
            "description": "Publication bias assessment"
        },
        "subgroup_analyses": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "variable": {"type": "string"},
                    "subgroups": {
                        "type": "array",
                        "items": {
                            "type": "object",
                            "properties": {
                                "name": {"type": "string"},
                                "n_studies": {"type": "integer"},
                                "estimate": {"type": "number"},
                                "ci_lower": {"type": "number"},
                                "ci_upper": {"type": "number"}
                            }
                        }
                    },
                    "interaction_p": {"type": "number", "minimum": 0, "maximum": 1}
                }
            },
            "description": "Subgroup analysis results"
        },
        "sensitivity_analyses": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "description": {"type": "string"},
                    "estimate": {"type": "number"},
                    "ci_lower": {"type": "number"},
                    "ci_upper": {"type": "number"},
                    "conclusion": {"type": "string"}
                }
            },
            "description": "Sensitivity analysis results"
        }
    },
    "required": ["analysis_type", "outcome", "n_studies", "pooled_effect"]
}

# Schema for PRISMA flow diagram data
PRISMA_SCHEMA: dict[str, Any] = {
    "type": "object",
    "properties": {
        "identification": {
            "type": "object",
            "properties": {
                "databases": {
                    "type": "array",
                    "items": {
                        "type": "object",
                        "properties": {
                            "name": {"type": "string"},
                            "records": {"type": "integer", "minimum": 0}
                        }
                    }
                },
                "registers": {"type": "integer", "minimum": 0},
                "other_sources": {"type": "integer", "minimum": 0}
            }
        },
        "screening": {
            "type": "object",
            "properties": {
                "duplicates_removed": {"type": "integer", "minimum": 0},
                "records_screened": {"type": "integer", "minimum": 0},
                "records_excluded": {"type": "integer", "minimum": 0}
            }
        },
        "eligibility": {
            "type": "object",
            "properties": {
                "reports_sought": {"type": "integer", "minimum": 0},
                "reports_not_retrieved": {"type": "integer", "minimum": 0},
                "reports_assessed": {"type": "integer", "minimum": 0},
                "reports_excluded": {"type": "integer", "minimum": 0},
                "exclusion_reasons": {
                    "type": "array",
                    "items": {
                        "type": "object",
                        "properties": {
                            "reason": {"type": "string"},
                            "count": {"type": "integer", "minimum": 0}
                        }
                    }
                }
            }
        },
        "included": {
            "type": "object",
            "properties": {
                "studies": {"type": "integer", "minimum": 0},
                "reports": {"type": "integer", "minimum": 0}
            }
        }
    },
    "required": ["identification", "screening", "eligibility", "included"]
}
