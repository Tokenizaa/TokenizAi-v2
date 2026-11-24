export function parseProfileList(output: string): Array<{ id: string; name: string; title?: string; role?: string; status: string }> {
  const bots: Array<{ id: string; name: string; title?: string; role?: string; status: string }> = [];
  const lines = output.split('\n');
  for (const line of lines) {
    // Parse table format: " ◆default         nvidia/nemotron-3.5-super-   running      —            —"
    // Columns: Profile, Model, Gateway, Alias, Distribution
    const match = line.match(/◆?\s*(\S+)\s+(\S+(?:\s+\S+)*)\s+(\S+)\s+(\S+)\s+(\S+)/);
    if (match && match[1] !== 'Profile' && match[1] !== '───────────────' && !match[1].startsWith('─')) {
      const id = match[1].replace(/^[◆\s]+/, '');
      const model = match[2];
      const gatewayStatus = match[3];
      const alias = match[4] !== '—' ? match[4] : undefined;
      bots.push({
        id,
        name: alias || id,
        title: alias || undefined,
        role: model.includes('nemotron') ? 'Nemotron Agent' : 'Agent',
        status: gatewayStatus === 'running' ? 'connected' : 'disconnected',
      });
    }
  }
  return bots;
}

export function parseKanbanJson(output: string): Array<{ id: string; title: string; status: string }> {
  try {
    const data = JSON.parse(output);
    return data.map((t: any) => ({
      id: t.id,
      title: t.title,
      status: t.status || 'todo',
    }));
  } catch {
    return [];
  }
}

export function parseCronList(output: string): Array<{ id: string; name: string; schedule: string; enabled: boolean }> {
  const routines: Array<{ id: string; name: string; schedule: string; enabled: boolean }> = [];
  const lines = output.split('\n');
  return routines;
}

export function parseSkillsList(output: string): Array<{ id: string; name: string; description?: string; status: string }> {
  const skills: Array<{ id: string; name: string; description?: string; status: string }> = [];
  const lines = output.split('\n');
  return skills;
}
