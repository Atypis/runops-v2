# Evaluation Framework Memo

## Overview
Evaluation framework for the Gmail → Airtable CRM workflow to measure agent reliability and guide optimization efforts during our 5-day sprint.

## Core Evaluation Components

### (a) Input Data: Synthetic Email Dataset
- **Size**: 16 emails (sufficient to stress-test the system)
- **Content**: Synthetic emails with varying investor/non-investor scenarios
- **Complexity**: Mix of clear investor emails, ambiguous cases, and obvious non-investor emails
- **Edge Cases**: Include challenging scenarios like existing vs new investors, different email formats

### (b) Baseline State: Pre-Run Airtable Status
- **Capture**: CSV export of Airtable CRM before each test run
- **Purpose**: Establishes starting point for comparison
- **Reset Process**: Manual restoration to baseline state between runs for clean testing

### (c) Ground Truth: Expected Final State
- **Definition**: How the Airtable should look after processing all 16 emails
- **Flexibility**: Not requiring 100% exact matches (e.g., summary variations acceptable)
- **Focus Areas**:
  - Factual correctness of investor information
  - Proper categorization (investor vs non-investor)
  - Accurate interaction logging
  - Correct handling of new vs existing records

### (d) LLM-Based Evaluator
- **Input**: Ground truth + actual output (post-run Airtable CSV)
- **Method**: LLM comparison with structured evaluation guidelines
- **Evaluation Criteria**:
  - Factual accuracy (names, companies, contact info)
  - Completeness (all investor emails processed)
  - Categorization correctness
  - Data integrity (no corruption of existing records)

### (e) Output Verification
- **Capture**: CSV export of final Airtable state after agent run
- **Comparison**: Against ground truth using LLM evaluator
- **Metrics**: Success rate, error categorization, failure mode analysis

## Success Metrics

### Primary Metrics
- **Task Completion Rate**: % of emails correctly processed
- **Accuracy Rate**: % of correct investor classifications
- **Data Integrity**: % of existing records preserved correctly
- **New Record Creation**: % of new investors added correctly

### Secondary Metrics
- **Catastrophic Failures**: Complete wrong actions (e.g., deleting data)
- **Partial Successes**: Correct classification but wrong data entry
- **False Positives**: Non-investors marked as investors
- **False Negatives**: Investors missed or ignored

## Evaluation Process

1. **Setup**: Reset Airtable to baseline state
2. **Execution**: Run agent on 16-email dataset
3. **Capture**: Export final Airtable state as CSV
4. **Evaluation**: LLM-based comparison against ground truth
5. **Analysis**: Categorize failures and identify improvement areas
6. **Iteration**: Apply learnings and repeat

## Sprint Integration

- **Day 1**: Build this evaluation framework
- **Days 2-5**: Use for rapid iteration and optimization
- **Target**: Achieve 90% success rate by end of sprint
- **Learning**: Identify highest-impact improvement areas for future development 