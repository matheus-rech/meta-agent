"""NeuroResearch Agent - AI-powered systematic review and meta-analysis."""

from .agent import NeuroResearchAgent, run_task
from .agent.schemas import EXTRACTION_SCHEMA, META_ANALYSIS_SCHEMA

__version__ = "1.0.0"
__all__ = ["NeuroResearchAgent", "run_task", "EXTRACTION_SCHEMA", "META_ANALYSIS_SCHEMA"]
