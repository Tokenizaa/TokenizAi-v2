import React from 'react';
import { FolderKanban } from 'lucide-react';
import { PageHeader } from '../../../components/ui/Primitives';
import { EmptyState } from '../components';

interface ProjectsPageProps { onNavigate: (id: string) => void; onToast: (msg: string) => void; }

export const ProjectsPage: React.FC<ProjectsPageProps> = () => (
  <div className="space-y-5">
    <PageHeader title="Projetos e metas operacionais" subtitle="Projetos empresariais pertencem ao domínio TokenizAi; projetos de execução do runtime só devem aparecer quando houver integração Hermes específica." />
    <EmptyState
      icon={<FolderKanban className="w-5 h-5" />}
      title="Projetos operacionais não expostos pelo Hermes"
      description="A integração Hermes atual não oferece endpoints de listagem de projetos e metas operacionais. Esta página não consulta dados empresariais como se fossem projetos do runtime e não apresenta registros fictícios. Os projetos empresariais continuam disponíveis no módulo corporativo."
    />
  </div>
);
