/**
 * Grammar point tracker — stores grammar concepts the user is working on
 * in their target language. File-based JSON storage in data/grammar-points.json.
 */

import * as fs from 'fs';
import * as path from 'path';

const DATA_FILE = path.join(process.cwd(), 'data', 'grammar-points.json');

export interface GrammarPoint {
    pattern: string;
    meaning: string;
    notes?: string;
    addedAt: string;
    lastDrilledAt?: string;
    drillCount: number;
    active: boolean;
}

function loadPoints(): GrammarPoint[] {
    try {
        if (!fs.existsSync(DATA_FILE)) return [];
        const raw = fs.readFileSync(DATA_FILE, 'utf-8');
        return JSON.parse(raw);
    } catch {
        return [];
    }
}

function savePoints(points: GrammarPoint[]): void {
    const dir = path.dirname(DATA_FILE);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(DATA_FILE, JSON.stringify(points, null, 2), 'utf-8');
}

export function addGrammarPoint(pattern: string, meaning: string, notes?: string): GrammarPoint {
    const points = loadPoints();
    const existing = points.find(p => p.pattern === pattern);
    if (existing) {
        existing.meaning = meaning;
        if (notes) existing.notes = notes;
        existing.active = true;
        savePoints(points);
        return existing;
    }
    const point: GrammarPoint = {
        pattern,
        meaning,
        notes,
        addedAt: new Date().toISOString(),
        drillCount: 0,
        active: true,
    };
    points.push(point);
    savePoints(points);
    return point;
}

export function removeGrammarPoint(pattern: string): boolean {
    const points = loadPoints();
    const idx = points.findIndex(p => p.pattern === pattern);
    if (idx === -1) return false;
    points[idx].active = false;
    savePoints(points);
    return true;
}

export function listGrammarPoints(activeOnly: boolean = true): GrammarPoint[] {
    const points = loadPoints();
    return activeOnly ? points.filter(p => p.active) : points;
}

/**
 * Pick the best grammar point for today's drill.
 * Prioritizes: least recently drilled > lowest drill count > oldest added.
 */
export function pickGrammarForDrill(): GrammarPoint | null {
    const active = listGrammarPoints(true);
    if (active.length === 0) return null;

    active.sort((a, b) => {
        if (!a.lastDrilledAt && b.lastDrilledAt) return -1;
        if (a.lastDrilledAt && !b.lastDrilledAt) return 1;
        if (a.lastDrilledAt && b.lastDrilledAt) {
            const diff = new Date(a.lastDrilledAt).getTime() - new Date(b.lastDrilledAt).getTime();
            if (diff !== 0) return diff;
        }
        return a.drillCount - b.drillCount;
    });

    return active[0];
}

export function markDrilled(pattern: string): void {
    const points = loadPoints();
    const point = points.find(p => p.pattern === pattern);
    if (point) {
        point.lastDrilledAt = new Date().toISOString();
        point.drillCount++;
        savePoints(points);
    }
}
