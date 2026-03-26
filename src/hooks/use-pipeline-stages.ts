import { useState, useEffect, useCallback } from 'react';

export interface PipelineStage {
  id: string;
  label: string;
  color: string;
  dotClass?: string | null;
  sort_order?: number;
  is_default?: boolean;
}

const FALLBACK_STAGES: PipelineStage[] = [
  { id: 'lead', label: 'Lead', color: 'var(--status-warning)', dotClass: 'bg-amber-400', sort_order: 0, is_default: true },
  { id: 'contacted', label: 'Contacted', color: '#60a5fa', dotClass: 'bg-blue-400', sort_order: 1, is_default: false },
  { id: 'proposal', label: 'Proposal', color: '#a78bfa', dotClass: 'bg-purple-400', sort_order: 2, is_default: false },
  { id: 'negotiation', label: 'Negotiation', color: '#f97316', dotClass: 'bg-orange-400', sort_order: 3, is_default: false },
  { id: 'won', label: 'Won', color: 'var(--status-success)', dotClass: 'bg-emerald-400', sort_order: 4, is_default: true },
  { id: 'lost', label: 'Lost', color: '#ef4444', dotClass: 'bg-red-400', sort_order: 5, is_default: true },
];

function getDotClass(color: string, id: string) {
  if (id === 'lead') return 'bg-amber-400';
  if (id === 'won') return 'bg-emerald-400';
  if (id === 'lost') return 'bg-red-400';
  return '';
}

export function usePipelineStages() {
  const [stages, setStages] = useState<PipelineStage[]>(FALLBACK_STAGES);
  const [loading, setLoading] = useState(true);

  const fetchStages = useCallback(async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/pipeline-stages');
      if (!response.ok) throw new Error('Failed to fetch pipeline stages');
      const data = await response.json();
      if (Array.isArray(data) && data.length > 0) {
        setStages(data.map((stage: PipelineStage) => ({
          ...stage,
          dotClass: stage.dotClass || getDotClass(stage.color, stage.id),
        })));
      } else {
        setStages(FALLBACK_STAGES);
      }
    } catch (error) {
      console.error('Error fetching pipeline stages:', error);
      setStages(FALLBACK_STAGES);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStages();
  }, [fetchStages]);

  return { stages, setStages, loading, refetch: fetchStages };
}
