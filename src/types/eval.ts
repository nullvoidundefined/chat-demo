/** Types for the offline eval dataset, run output, and judge scores. */
export type EvalItem = {
    id: string;
    question: string;
    rubric: string;
    referenceFacts?: string[];
};

export type EvalRunOutput = {
    finalAnswer: string;
    toolsUsed: string[];
    iterationCount: number;
};

export type Score = {
    factuality: number;
    citationUse: number;
    completeness: number;
    toolEfficiency: number;
    rationale: string;
    pass: boolean;
};

export type EvalResult = {
    item: EvalItem;
    run: EvalRunOutput;
    score: Score;
};
