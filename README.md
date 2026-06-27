# People Management 2.0

Painel executivo de gestão contemporânea de pessoas, desenvolvido para gestores da **Bússola Executiva**. Permite acompanhamento individualizado de colaboradores, timeline de desenvolvimento, inputs do gestor, mapeamento de desafios, materiais de apoio e síntese executiva para tomada de decisão.

## Objetivo

Construir um painel de gestão de pessoas 2.0 onde cada gestor possa:

- Configurar sua empresa, logo e identidade visual
- Acompanhar individualmente os membros do time
- Registrar inputs objetivos com data
- Criar timeline de desenvolvimento
- Mapear desafios, oportunidades e pontos de atenção
- Utilizar materiais da Bússola Executiva
- Gerar síntese executiva para reuniões com Diretoria, RH ou People Partner

## Como abrir localmente

1. Baixe ou clone a pasta do projeto
2. Abra o arquivo `index.html` diretamente no navegador (Chrome, Edge ou Firefox recomendados)

> **Nota:** Para carregar os dados de demonstração na primeira execução, é recomendável usar um servidor local simples (ex.: extensão Live Server no VS Code) para que o `data.json` seja carregado corretamente. Alternativamente, use o botão **Restaurar Demo** na seção Dados & Backup.

### Servidor local rápido (opcional)

```bash
# Python 3
python -m http.server 8080

# Node.js (npx)
npx serve .
```

Acesse: `http://localhost:8080`

## Estrutura de arquivos

| Arquivo      | Descrição                                      |
|-------------|------------------------------------------------|
| `index.html`| Interface principal (SPA)                      |
| `styles.css`| Estilos executivos e responsivos               |
| `app.js`    | Lógica, CRUD, gráficos e persistência          |
| `data.json` | Dados mockados de demonstração                 |
| `README.md` | Esta documentação                                |

## Configurar empresa e logo

1. Acesse **Empresa** no menu lateral
2. Preencha: Nome da empresa, Gestor responsável, Área/Time
3. Escolha a cor principal da identidade visual
4. Faça upload do logo (formato imagem)
5. As alterações são salvas automaticamente no `localStorage`

As informações aparecem no cabeçalho, dashboards, relatórios e síntese executiva.

## Cadastrar colaboradores

1. Acesse **Colaboradores**
2. Clique em **+ Novo Colaborador**
3. Preencha os campos (nome é obrigatório)
4. Defina níveis de 1 a 5, semáforo executivo e tags comportamentais
5. Use os filtros para pesquisar por nome, status, área, risco ou semáforo

Ações disponíveis: visualizar perfil (com radar individual), editar e excluir.

## Registrar inputs do gestor

1. Acesse **Inputs do Gestor**
2. Clique em **+ Novo Input**
3. Selecione colaborador, tipo e preencha descrição objetiva
4. Adicione evidência, recomendação, próximo passo e prazo
5. Filtre por colaborador, tipo ou status

> Registre fatos observáveis, não julgamentos. Veja a seção **Governança & LGPD**.

## Timeline de desenvolvimento

1. Acesse **Timeline**
2. Clique em **+ Novo Evento**
3. Associe ao colaborador, defina tipo, impacto e próxima ação
4. Acompanhe o histórico visual por colaborador

## Gerar síntese executiva

1. Acesse **Síntese Executiva**
2. Clique em **Gerar Síntese Executiva**
3. A síntese consolida automaticamente status do time, evoluções, riscos, destaques, ações e recomendações
4. Use **Copiar**, **Exportar TXT** ou **Exportar PDF** (via impressão do navegador)

Também disponível pelo botão **Síntese Rápida** no cabeçalho.

## Exportar e importar JSON

Na seção **Dados & Backup**:

- **Exportar JSON** — download da base completa
- **Importar JSON** — restaurar de um backup
- **Criar Backup** — backup com data no nome do arquivo
- **Restaurar Demo** — recarrega dados mockados do `data.json`
- **Limpar Dados** — remove tudo do navegador (com confirmação dupla)

## Compartilhar via OneDrive / SharePoint

1. Copie a pasta completa do projeto para o OneDrive ou SharePoint
2. Compartilhe a pasta com colegas da Bússola Executiva
3. Cada gestor abre o `index.html` localmente ou via link compartilhado
4. Para sincronizar dados entre dispositivos, use **Exportar JSON** e compartilhe o arquivo de backup

> Na versão atual, os dados ficam no `localStorage` de cada navegador. A integração com Supabase permitirá sincronização em nuvem com isolamento por empresa.

## Evolução para Supabase

A estrutura de dados já prevê campos para integração futura:

| Campo        | Uso futuro                              |
|-------------|-----------------------------------------|
| `company_id`| Isolamento multiempresa (RLS)           |
| `user_id`   | Identificação do usuário autenticado    |
| `role`      | Perfil de acesso                        |
| `manager_id`| Hierarquia de gestão                    |
| `team_id`   | Segregação por time                     |
| `created_by`| Auditoria de criação                    |
| `updated_by`| Auditoria de atualização                |
| `created_at`| Timestamp de criação                    |
| `updated_at`| Timestamp de atualização                  |

### Perfis de acesso previstos

- Admin geral
- Gestor da empresa
- Gestor de time
- RH / People Partner
- Usuário visualizador

### Tabelas sugeridas no Supabase

```sql
-- companies: dados da empresa (nome, logo, cor, gestor)
-- users: usuários autenticados vinculados a company_id
-- teams: times/áreas dentro da empresa
-- employees: colaboradores com todos os indicadores
-- manager_inputs: registros datados do gestor
-- development_timeline: eventos de evolução
-- challenges: desafios e oportunidades
-- compass_materials: repositório Bússola Executiva
-- executive_summaries: histórico de sínteses geradas
-- audit_logs: trilha de auditoria para LGPD
```

Implementação futura:

1. Autenticação via Supabase Auth
2. Row Level Security (RLS) por `company_id`
3. Políticas de acesso por `role`
4. Substituição do `localStorage` por chamadas à API
5. Pontos marcados no código com `[SUPABASE]`

## LGPD, ética e governança

- Registre **fatos**, não julgamentos
- Evite opiniões pessoais sem evidência
- **Não** registre informações médicas ou clínicas
- Não use termos discriminatórios
- Use a ferramenta para **desenvolvimento**, não punição
- Proteja dados pessoais conforme a LGPD
- Exporte informações apenas para uso interno autorizado
- A seção **NR-1** apoia gestão preventiva — não realiza diagnóstico médico ou psicológico

## Dados de demonstração

O `data.json` inclui:

- Empresa fictícia: TechNova Soluções
- Gestora: Ana Carolina Mendes
- 5 colaboradores com perfis variados
- Inputs, timeline, desafios e materiais simulados

## Tecnologias

- HTML5, CSS3, JavaScript (vanilla)
- Chart.js (CDN) para gráficos
- localStorage para persistência local
- Sem dependências pagas

## Suporte

Ferramenta desenvolvida para uso individual por gestores e compartilhamento entre colegas da Bússola Executiva. Para dúvidas sobre metodologia de gestão de pessoas, consulte os materiais da Bússola Executiva.

---

**People Management 2.0** — Bússola Executiva © 2026
