# Sky Operations Hub

Crie uma aplicação web responsiva, moderna e profissional chamada EVV — Sistema de Operações do Voo a Vela.

O objetivo é centralizar as informações diárias de uma operação de Voo a Vela, substituindo planilhas, mensagens dispersas e quadros físicos por um painel único, simples e rápido de consultar.

A aplicação deve funcionar muito bem tanto em computador quanto em tablet e celular.

1. VISUAL E IDENTIDADE

Criar uma interface inspirada em sistemas operacionais de aviação.

Estilo:

moderno;

limpo;

profissional;

militar/aeronáutico sem exageros;

alta legibilidade;

poucos elementos desnecessários;

interface rápida para consulta durante a operação.

Paleta sugerida:

azul escuro;

azul aeronáutico;

branco;

cinza claro;

verde para informações positivas;

amarelo para atenção;

vermelho para indisponibilidade ou alerta.

Usar cards, tabelas simples, badges de status e ícones discretos.

Nome no topo:

EVV
Sistema de Operações — Voo a Vela

2. LOGIN E USUÁRIOS

Criar sistema de autenticação.

Cada usuário deve possuir:

nome completo;

nome de guerra;

turma;

função/perfil;

e-mail;

senha.

Perfis de acesso:

Administrador

Pode:

criar e editar usuários;

configurar funções;

alterar qualquer informação;

criar operações;

editar escalas;

editar meteorologia;

alterar aeronaves;

publicar briefing;

criar avisos;

consultar histórico.

Operador

Pode:

editar informações da operação;

lançar meteorologia;

editar serviço do dia;

atualizar aeronaves;

lançar observações;

preencher briefing.

Usuário

Pode:

consultar informações;

visualizar sua função;

visualizar briefing;

visualizar meteorologia;

visualizar escala;

confirmar ciência do briefing.

Utilizar Supabase Authentication e Supabase Database.

3. DASHBOARD PRINCIPAL

Após o login, abrir diretamente o painel da operação atual.

No topo mostrar:

OPERAÇÃO DE HOJE

Data

Status geral da operação:

NÃO INICIADA

BRIEFING

EM OPERAÇÃO

SUSPENSA

ENCERRADA

O status deve possuir cor correspondente.

Mostrar também:

horário previsto de início;

horário do briefing;

pista em uso;

área de operação;

observações gerais.

Criar cards principais:

Minha função hoje

Mostrar imediatamente a função atribuída ao usuário.

Exemplo:

STAINKI
Anotador

ou

ANDRADE
Ponta de Cabo

Meteorologia

Resumo rápido:

vento;

direção;

rajada;

temperatura;

pressão;

cobertura;

visibilidade;

teto;

observação.

Aeronaves

Mostrar rapidamente:

DG-1000 — DISPONÍVEL
DG-1001 — EM VOO
Ipanema — DISPONÍVEL

Avisos

Mostrar avisos importantes da operação.

4. SERVIÇO DO DIA

Criar uma página chamada:

Serviço do Dia

Permitir montar a escala de funções da operação.

Funções inicialmente disponíveis:

Chefe da operação

Instrutor

Piloto rebocador

Aluno em voo

Ponta de cabo

Anotador

Operador de pista

Material

Rádio

Apoio

O administrador deve poder criar novas funções posteriormente.

Mostrar em formato de tabela:

FUNÇÃO | MILITAR | HORÁRIO | OBSERVAÇÃO

Permitir arrastar pessoas entre funções ou selecionar por dropdown.

Uma mesma pessoa pode possuir mais de uma função em horários diferentes.

Destacar para cada usuário a sua própria função.

Permitir registrar substituição:

Exemplo:

Ponta de Cabo
08:00–10:00 — STAINKI
10:00–12:00 — ROMANI

5. DETALHES DA OPERAÇÃO

Página:

Operação

Campos:

data;

local;

pista;

cabeceira;

área de operação;

horário do briefing;

início previsto;

término previsto;

responsável pela operação;

instrutores;

rebocadores;

planadores disponíveis;

frequência de rádio;

observações.

Criar campo:

Objetivo da operação

Exemplo:

“Instrução de lançamento, circuito de tráfego e pouso.”

Criar campo:

Restrições da operação

Exemplo:

“Operação limitada até 15 kt de vento cruzado.”

6. METEOROLOGIA

Criar página específica chamada:

Meteorologia

Os dados serão inicialmente inseridos MANUALMENTE.

Criar formulário com:

Horário da observação

Vento

direção;

intensidade;

rajada;

componente de través;

componente de proa/cauda.

Atmosfera

temperatura;

ponto de orvalho;

pressão QNH;

visibilidade;

umidade.

Nuvens

cobertura;

base;

tipo;

observação.

Condições para voo a vela

Criar campos específicos:

presença de térmicas;

intensidade estimada;

teto estimado das térmicas;

cobertura cumuliforme;

possibilidade de chuva;

turbulência;

condições gerais.

Classificação:

POBRE
REGULAR
BOA
MUITO BOA
EXCELENTE

Adicionar campo grande:

Análise meteorológica

Permitir escrever livremente observações.

Registrar automaticamente:

usuário que inseriu;

horário da atualização.

Manter histórico das atualizações meteorológicas durante o dia.

7. BRIEFING

Criar página:

Briefing da Operação

O briefing deve possuir seções editáveis.

Situação geral

Meteorologia

Pista e área de operação

Procedimentos

Sequência dos voos

Segurança

Comunicações

Situações especiais

Observações finais

Permitir anexar:

imagens;

PDFs;

diagramas.

Após o briefing ser publicado, cada usuário deve possuir botão:

LI E ESTOU CIENTE DO BRIEFING

Registrar:

usuário;

data;

horário.

O administrador deve conseguir visualizar quem ainda não confirmou ciência.

8. AERONAVES

Página:

Aeronaves

Criar cadastro de aeronaves.

Tipos:

planador;

rebocador.

Campos:

modelo;

matrícula/número;

tipo;

status;

observação.

Status possíveis:

DISPONÍVEL
EM PREPARAÇÃO
EM VOO
INDISPONÍVEL
MANUTENÇÃO

Exemplo:

DG-1000 | 8121 | EM VOO

Mostrar status com cores.

Permitir atualizar rapidamente o status durante a operação.

9. SEQUÊNCIA DE VOOS

Criar página:

Sequência de Voos

Tabela:

ORDEM | ALUNO | INSTRUTOR | PLANADOR | OBJETIVO | STATUS

Status:

AGUARDANDO
PREPARANDO
PRONTO
EM VOO
POUSADO
CANCELADO

Permitir reordenar a sequência por drag and drop.

Ao clicar em “EM VOO”, registrar horário de decolagem.

Ao clicar em “POUSADO”, registrar horário de pouso.

Calcular automaticamente:

Tempo de voo

10. QUADRO OPERACIONAL

Criar uma tela especial chamada:

Quadro Operacional

Essa tela deve ser otimizada para ficar aberta em um tablet ou monitor durante toda a operação.

Mostrar em uma única tela:

status da operação;

hora atual;

meteorologia;

vento;

pista;

próxima aeronave;

aluno atual;

sequência dos próximos voos;

aeronaves disponíveis;

avisos;

funções críticas do serviço.

Usar elementos grandes e muito fáceis de ler à distância.

11. AVISOS

Criar sistema de avisos.

Categorias:

INFORMAÇÃO
ATENÇÃO
SEGURANÇA
URGENTE

Exemplo:

“ATENÇÃO — mudança da cabeceira para pista 20.”

Avisos devem aparecer imediatamente no dashboard.

Permitir determinar horário de validade.

12. HISTÓRICO

Criar página:

Histórico de Operações

Permitir selecionar uma data passada e visualizar:

escala;

meteorologia;

briefing;

aeronaves;

sequência dos voos;

horários;

observações;

avisos.

Nada de uma operação antiga deve ser perdido.

13. LOG DE ALTERAÇÕES

Toda alteração importante deve registrar:

usuário;

ação;

data;

horário.

Exemplo:

10:32 — STAINKI alterou DG-1000 8121 de DISPONÍVEL para EM VOO.

14. ESTRUTURA DO BANCO DE DADOS

Criar tabelas no Supabase para:

users
operations
operation_roles
roles
weather_reports
briefings
briefing_acknowledgements
aircraft
flight_queue
notices
operation_logs

Utilizar relacionamentos adequados entre tabelas.

Adicionar Row Level Security para impedir que usuários comuns editem informações administrativas.

15. EXPERIÊNCIA DE USO

A interface precisa priorizar rapidez.

Evitar páginas excessivamente complexas.

Informações importantes devem aparecer com no máximo 1 ou 2 cliques.

O Dashboard deve responder imediatamente às seguintes perguntas:

Qual é minha função hoje?

Que horas começa a operação?

Qual a condição meteorológica?

Qual pista está em uso?

Qual aeronave está voando?

Quem é o próximo?

Existe algum aviso importante?

16. PRIMEIRA VERSÃO

Implemente inicialmente um MVP totalmente funcional contendo:

Login

Dashboard

Serviço do dia

Operação

Meteorologia

Briefing

Aeronaves

Sequência de voos

Avisos

Histórico

Use dados fictícios inicialmente para demonstrar o funcionamento.

Depois conecte todas as páginas ao Supabase para persistência real dos dados.

Não crie apenas um protótipo visual. Crie uma aplicação funcional, com navegação, banco de dados, autenticação e CRUD das informações.

This project was built with [Lovable](https://lovable.dev).

**Live app**: https://esquadraodevooavela.lovable.app

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/c7f5d1bf-6d8c-4322-a6f5-a8361e836669).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
