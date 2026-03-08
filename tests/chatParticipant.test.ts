/**
 * Tests for Chat Participant
 * 
 * Tests natural language intent inference and command routing.
 */

// Import the intent inference logic - we'll extract it for testing
// For now, we replicate the logic here to test it

describe('ChatParticipant Intent Inference', () => {
    /**
     * Replicated intent inference logic from chatParticipant.ts
     * In production, this would be exported and imported directly
     */
    function inferIntent(prompt: string): { command: string | null; query: string } {
        const lower = prompt.toLowerCase();

        // Restore/session patterns
        if (lower.match(/^(restore|resume|continue|pick up|load session|start session)/)) {
            return { command: 'restore', query: '' };
        }

        // Capture code patterns - must check BEFORE handoff (to catch "save code")
        if (lower.match(/^(capture code|save code|record code|capture selected|capture this code)/)) {
            const match = prompt.match(/(?:capture|save|record)\s*(?:code|selected|this code)\s*[:-]?\s*(.*)/i);
            return { command: 'code', query: match?.[1] || '' };
        }

        // Handoff/save patterns - after capture code check
        if (lower.match(/^(handoff|save session|save\s*:|save$|end session|create handoff|preserve|checkpoint)/)) {
            const match = prompt.match(/(?:handoff|save|checkpoint)\s*[:-]?\s*(.*)/i);
            return { command: 'handoff', query: match?.[1] || '' };
        }

        // Synthesize patterns
        if (lower.match(/^(synthesize|summarize|generate summary|project summary|context summary)/)) {
            return { command: 'synthesize', query: '' };
        }

        // Capture context/decision patterns
        if (lower.match(/^(capture|record|remember|note|decision|decided|chose|choosing)/)) {
            const match = prompt.match(/(?:capture|record|remember|note|decision|decided|chose)\s*[:-]?\s*(.*)/i);
            return { command: 'capture', query: match?.[1] || prompt };
        }

        // List models patterns
        if (lower.match(/^(list|show)\s*(my\s*)?(world\s*)?models?|^my\s*(world\s*)?models?/)) {
            return { command: 'models', query: '' };
        }

        // Get context patterns
        if (lower.match(/^(get|show|load|what('?s| is))\s*(the\s*)?(project\s*)?(context|world model)/)) {
            return { command: 'context', query: '' };
        }

        // Help patterns
        if (lower.match(/^(help|commands|what can you|how do i|usage)/)) {
            return { command: 'help', query: '' };
        }

        // Search patterns (explicit)
        if (lower.match(/^(search|find|look for|query|what|why|how|where|when)/)) {
            const match = prompt.match(/(?:search|find|look for|query)\s*(?:for)?\s*[:-]?\s*(.*)/i);
            return { command: 'search', query: match?.[1] || prompt };
        }

        // Default to search with full prompt
        return { command: 'search', query: prompt };
    }

    describe('Session Commands', () => {
        it('should recognize restore intent', () => {
            expect(inferIntent('restore').command).toBe('restore');
            expect(inferIntent('resume').command).toBe('restore');
            expect(inferIntent('continue from where I left off').command).toBe('restore');
            expect(inferIntent('pick up my session').command).toBe('restore');
            expect(inferIntent('load session').command).toBe('restore');
            expect(inferIntent('start session').command).toBe('restore');
        });

        it('should recognize handoff intent', () => {
            expect(inferIntent('handoff').command).toBe('handoff');
            expect(inferIntent('save session').command).toBe('handoff');
            expect(inferIntent('end session').command).toBe('handoff');
            expect(inferIntent('create handoff').command).toBe('handoff');
            expect(inferIntent('checkpoint').command).toBe('handoff');
        });

        it('should extract handoff summary', () => {
            const result = inferIntent('handoff: Finished auth implementation');
            expect(result.command).toBe('handoff');
            expect(result.query).toBe('Finished auth implementation');
        });

        it('should handle save with summary', () => {
            const result = inferIntent('save: End of day');
            expect(result.command).toBe('handoff');
            expect(result.query).toBe('End of day');
        });
    });

    describe('Knowledge Graph Commands', () => {
        it('should recognize synthesize intent', () => {
            expect(inferIntent('synthesize').command).toBe('synthesize');
            expect(inferIntent('summarize the project').command).toBe('synthesize');
            expect(inferIntent('generate summary').command).toBe('synthesize');
            expect(inferIntent('project summary').command).toBe('synthesize');
            expect(inferIntent('context summary').command).toBe('synthesize');
        });

        it('should recognize explicit search intent', () => {
            expect(inferIntent('search auth decisions').command).toBe('search');
            expect(inferIntent('find database patterns').command).toBe('search');
            expect(inferIntent('look for caching strategy').command).toBe('search');
            expect(inferIntent('query architecture').command).toBe('search');
        });

        it('should extract search queries', () => {
            const result = inferIntent('search for authentication flow');
            expect(result.command).toBe('search');
            expect(result.query).toBe('authentication flow');
        });

        it('should recognize question words as search', () => {
            expect(inferIntent('what decisions were made?').command).toBe('search');
            expect(inferIntent('why did we choose Postgres?').command).toBe('search');
            expect(inferIntent('how does auth work?').command).toBe('search');
            expect(inferIntent('where is the config?').command).toBe('search');
            expect(inferIntent('when was this decided?').command).toBe('search');
        });
    });

    describe('Capture Commands', () => {
        it('should recognize capture context intent', () => {
            expect(inferIntent('capture this decision').command).toBe('capture');
            expect(inferIntent('record that we chose JWT').command).toBe('capture');
            expect(inferIntent('remember this pattern').command).toBe('capture');
            expect(inferIntent('note: using Redis for cache').command).toBe('capture');
            expect(inferIntent('decision: PostgreSQL for ACID').command).toBe('capture');
            expect(inferIntent('decided to use microservices').command).toBe('capture');
            expect(inferIntent('chose Redis over Memcached').command).toBe('capture');
        });

        it('should extract capture content', () => {
            const result = inferIntent('capture: We chose JWT for stateless auth');
            expect(result.command).toBe('capture');
            expect(result.query).toBe('We chose JWT for stateless auth');
        });

        it('should recognize capture code intent', () => {
            expect(inferIntent('capture code').command).toBe('code');
            expect(inferIntent('save code').command).toBe('code');
            expect(inferIntent('capture selected').command).toBe('code');
            expect(inferIntent('capture this code').command).toBe('code');
        });

        it('should extract code description', () => {
            const result = inferIntent('capture code: Auth middleware');
            expect(result.command).toBe('code');
            expect(result.query).toBe('Auth middleware');
        });
    });

    describe('Other Commands', () => {
        it('should recognize list models intent', () => {
            expect(inferIntent('list models').command).toBe('models');
            expect(inferIntent('show my models').command).toBe('models');
            expect(inferIntent('my world models').command).toBe('models');
            expect(inferIntent('list world models').command).toBe('models');
        });

        it('should recognize get context intent', () => {
            expect(inferIntent('get context').command).toBe('context');
            expect(inferIntent('show project context').command).toBe('context');
            expect(inferIntent('load world model').command).toBe('context');
            expect(inferIntent("what's the context").command).toBe('context');
            expect(inferIntent('what is the project context').command).toBe('context');
        });

        it('should recognize help intent', () => {
            expect(inferIntent('help').command).toBe('help');
            expect(inferIntent('commands').command).toBe('help');
            expect(inferIntent('what can you do?').command).toBe('help');
            expect(inferIntent('how do I use this?').command).toBe('help');
            expect(inferIntent('usage').command).toBe('help');
        });
    });

    describe('Default Behavior', () => {
        it('should default to search for unknown patterns', () => {
            expect(inferIntent('random text here').command).toBe('search');
            expect(inferIntent('authentication patterns in our codebase').command).toBe('search');
        });

        it('should preserve full query for default search', () => {
            const result = inferIntent('authentication patterns in our codebase');
            expect(result.query).toBe('authentication patterns in our codebase');
        });
    });

    describe('Case Insensitivity', () => {
        it('should handle uppercase commands', () => {
            expect(inferIntent('RESTORE').command).toBe('restore');
            expect(inferIntent('HANDOFF').command).toBe('handoff');
            expect(inferIntent('SYNTHESIZE').command).toBe('synthesize');
        });

        it('should handle mixed case', () => {
            expect(inferIntent('Restore Session').command).toBe('restore');
            expect(inferIntent('Create Handoff').command).toBe('handoff');
        });
    });
});

describe('Handoff ID Parsing', () => {
    const UUID_PATTERN = /([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/i;

    it('should extract UUID from response text', () => {
        const text = 'Handoff created: 19d2b059-246d-4b6d-baaf-c779516e255d';
        const match = text.match(UUID_PATTERN);
        expect(match).toBeTruthy();
        expect(match![1]).toBe('19d2b059-246d-4b6d-baaf-c779516e255d');
    });

    it('should find UUID anywhere in text', () => {
        const text = 'Session restored from handoff abc12345-1234-5678-9abc-def012345678 successfully';
        const match = text.match(UUID_PATTERN);
        expect(match![1]).toBe('abc12345-1234-5678-9abc-def012345678');
    });

    it('should handle uppercase UUIDs', () => {
        const text = 'ID: ABC12345-1234-5678-9ABC-DEF012345678';
        const match = text.match(UUID_PATTERN);
        expect(match).toBeTruthy();
    });

    it('should return null for text without UUID', () => {
        const text = 'No handoff ID here';
        const match = text.match(UUID_PATTERN);
        expect(match).toBeNull();
    });
});
