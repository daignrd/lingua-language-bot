import { getCurrentTimeToolDefinition, executeGetCurrentTime } from './time.ts';
import { addCoreFactToolDefinition, deleteCoreFactToolDefinition, executeAddCoreFact, executeDeleteCoreFact } from './memory.ts';
import { searchPastConversationsToolDefinition, commitEpisodeToolDefinition, executeSearchPastConversations, executeCommitEpisode } from './episodic.ts';
import { upsertGraphNodeToolDefinition, addGraphEdgeToolDefinition, getEntityRelationsToolDefinition, executeUpsertGraphNode, executeAddGraphEdge, executeGetEntityRelations } from './graph.ts';
import { optimizeMemoryToolDefinition, executeOptimizeMemory } from './memory_manager.ts';
import { readFileToolDefinition, writeFileToolDefinition, listDirToolDefinition, deleteFileToolDefinition, executeReadFile, executeWriteFile, executeListDir, executeDeleteFile } from './file.ts';
import { webSearchToolDefinition, executeWebSearch } from './search.ts';
import { pushToCanvasToolDefinition, executePushToCanvas } from './canvas.ts';
import { saveGrammarPointToolDefinition, removeGrammarPointToolDefinition, listGrammarPointsToolDefinition, pickGrammarDrillToolDefinition, executeSaveGrammarPoint, executeRemoveGrammarPoint, executeListGrammarPoints, executePickGrammarDrill } from './grammar.ts';

export const ALL_TOOLS = [
    getCurrentTimeToolDefinition,
    addCoreFactToolDefinition,
    deleteCoreFactToolDefinition,
    searchPastConversationsToolDefinition,
    commitEpisodeToolDefinition,
    upsertGraphNodeToolDefinition,
    addGraphEdgeToolDefinition,
    getEntityRelationsToolDefinition,
    optimizeMemoryToolDefinition,
    readFileToolDefinition,
    writeFileToolDefinition,
    listDirToolDefinition,
    deleteFileToolDefinition,
    webSearchToolDefinition,
    pushToCanvasToolDefinition,
    saveGrammarPointToolDefinition,
    removeGrammarPointToolDefinition,
    listGrammarPointsToolDefinition,
    pickGrammarDrillToolDefinition,
];

export async function executeTool(name: string, args: any): Promise<string> {
    switch (name) {
        case 'get_current_time':
            return executeGetCurrentTime();
        case 'add_core_fact':
            return executeAddCoreFact(args);
        case 'delete_core_fact':
            return executeDeleteCoreFact(args);
        case 'search_past_conversations':
            return executeSearchPastConversations(args);
        case 'commit_episode':
            return executeCommitEpisode(args);
        case 'upsert_graph_node':
            return executeUpsertGraphNode(args);
        case 'add_graph_edge':
            return executeAddGraphEdge(args);
        case 'get_entity_relations':
            return executeGetEntityRelations(args);
        case 'optimize_memory':
            return executeOptimizeMemory();
        case 'read_file':
            return executeReadFile(args);
        case 'write_file':
            return executeWriteFile(args);
        case 'list_dir':
            return executeListDir(args);
        case 'delete_file':
            return executeDeleteFile(args);
        case 'web_search':
            return executeWebSearch(args);
        case 'push_to_canvas':
            return executePushToCanvas(args);
        case 'save_grammar_point':
            return executeSaveGrammarPoint(args);
        case 'remove_grammar_point':
            return executeRemoveGrammarPoint(args);
        case 'list_grammar_points':
            return executeListGrammarPoints();
        case 'pick_grammar_drill':
            return executePickGrammarDrill();
        default:
            throw new Error(`Unknown tool: ${name}`);
    }
}
