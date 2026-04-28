import { addGrammarPoint, removeGrammarPoint, listGrammarPoints, pickGrammarForDrill, markDrilled } from '../services/grammar.ts';

export const saveGrammarPointToolDefinition = {
    type: 'function' as const,
    function: {
        name: 'save_grammar_point',
        description: 'Save a grammar point in the target language that the user wants to practice. Use this when the user mentions a grammar concept they are struggling with or want to be drilled on.',
        parameters: {
            type: 'object',
            properties: {
                pattern: { type: 'string', description: 'The grammar pattern in the target language (e.g. "congiuntivo presente", "passato prossimo with avere vs essere")' },
                meaning: { type: 'string', description: 'Brief explanation of the grammar point in the user\'s native language' },
                notes: { type: 'string', description: 'Optional user context or notes about why they want to practice this' },
            },
            required: ['pattern', 'meaning'],
        },
    },
};

export const removeGrammarPointToolDefinition = {
    type: 'function' as const,
    function: {
        name: 'remove_grammar_point',
        description: 'Deactivate a grammar point from the drill rotation. Use when the user says they have mastered a grammar point or no longer want to be drilled on it.',
        parameters: {
            type: 'object',
            properties: {
                pattern: { type: 'string', description: 'The grammar pattern to remove' },
            },
            required: ['pattern'],
        },
    },
};

export const listGrammarPointsToolDefinition = {
    type: 'function' as const,
    function: {
        name: 'list_grammar_points',
        description: 'List all active grammar points the user is currently practicing.',
        parameters: {
            type: 'object',
            properties: {},
        },
    },
};

export const pickGrammarDrillToolDefinition = {
    type: 'function' as const,
    function: {
        name: 'pick_grammar_drill',
        description: 'Pick the best grammar point for today\'s drill based on rotation logic (least recently drilled, lowest count). Returns the grammar point and marks it as drilled.',
        parameters: {
            type: 'object',
            properties: {},
        },
    },
};

export function executeSaveGrammarPoint(args: any): string {
    const point = addGrammarPoint(args.pattern, args.meaning, args.notes);
    return `Grammar point saved: ${point.pattern} — ${point.meaning}${point.notes ? ` (Notes: ${point.notes})` : ''}`;
}

export function executeRemoveGrammarPoint(args: any): string {
    const success = removeGrammarPoint(args.pattern);
    return success
        ? `Grammar point "${args.pattern}" deactivated from drill rotation.`
        : `Grammar point "${args.pattern}" not found.`;
}

export function executeListGrammarPoints(): string {
    const points = listGrammarPoints(true);
    if (points.length === 0) {
        return 'No active grammar points. The user can tell you about grammar concepts they want to practice and you should save them.';
    }
    const list = points.map((p, i) => {
        const drilled = p.lastDrilledAt ? `last drilled ${p.lastDrilledAt.split('T')[0]}` : 'never drilled';
        return `${i + 1}. ${p.pattern} — ${p.meaning} (${drilled}, ${p.drillCount}x)${p.notes ? ` [${p.notes}]` : ''}`;
    }).join('\n');
    return `Active grammar points (${points.length}):\n${list}`;
}

export function executePickGrammarDrill(): string {
    const point = pickGrammarForDrill();
    if (!point) {
        return 'No active grammar points to drill. The user needs to add some first.';
    }
    markDrilled(point.pattern);
    return `Today's grammar drill:\nPattern: ${point.pattern}\nMeaning: ${point.meaning}\nDrill count: ${point.drillCount + 1}${point.notes ? `\nUser notes: ${point.notes}` : ''}\n\nGenerate an example sentence using this pattern for the user to shadow.`;
}
