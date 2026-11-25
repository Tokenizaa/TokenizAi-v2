import React from 'react';
import { WorkforcePage } from './WorkforcePage';
import type { WorkforcePageProps } from './WorkforcePage';

export const DashboardPage: React.FC<WorkforcePageProps> = (props) => (
  <WorkforcePage section="ia-visao" {...props} />
);

export const ChatPage: React.FC<WorkforcePageProps> = (props) => (
  <WorkforcePage section="ia-chat" {...props} />
);

export const AgentsPage: React.FC<WorkforcePageProps> = (props) => (
  <WorkforcePage section="ia-agentes" {...props} />
);

export const OrganizationPage: React.FC<WorkforcePageProps> = (props) => (
  <WorkforcePage section="ia-equipes" {...props} />
);

export const TasksPage: React.FC<WorkforcePageProps> = (props) => (
  <WorkforcePage section="ia-tarefas" {...props} />
);

export const RunsPage: React.FC<WorkforcePageProps> = (props) => (
  <WorkforcePage section="ia-execucoes" {...props} />
);

export const RoutinesPage: React.FC<WorkforcePageProps> = (props) => (
  <WorkforcePage section="ia-rotinas" {...props} />
);

export const ApprovalsPage: React.FC<WorkforcePageProps> = (props) => (
  <WorkforcePage section="ia-aprovacoes" {...props} />
);

export const CostsPage: React.FC<WorkforcePageProps> = (props) => (
  <WorkforcePage section="ia-custos" {...props} />
);
