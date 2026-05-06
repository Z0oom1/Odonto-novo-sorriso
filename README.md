# Sistema Odontológico NOVO SORRISO

Bem-vindo ao sistema de gestão da clínica NOVO SORRISO. Este sistema foi desenvolvido com tecnologias web modernas (HTML5, CSS3, JavaScript e IndexedDB) para garantir performance, estética premium e funcionalidade offline/local.

## Estrutura do Projeto

- **/desktop**: Sistema interno para funcionários.
- **/web**: Site público para clientes (Agendamento Online).

## Como Iniciar

### 1. Sistema Interno (Funcionários)
1. Navegue até a pasta `desktop`.
2. Abra o arquivo `index.html` em qualquer navegador (Chrome, Edge ou Safari recomendado).
3. **Login Padrão:**
   - **Usuário:** `admin`
   - **Senha:** `admin123`

### 2. Site de Clientes (Agendamento)
1. Navegue até a pasta `web`.
2. Abra o arquivo `index.html`.
3. Lá você pode realizar agendamentos que aparecerão automaticamente no sistema interno (desde que abertos no mesmo navegador, pois utilizam o mesmo banco de dados local `IndexedDB`).

### 3. Portal do Paciente
1. Após um agendamento, o paciente recebe um link (simulado).
2. Para testar o portal, abra `web/portal.html?id=1` (substitua o ID pelo ID do agendamento criado).

---

## Funcionalidades Principais

### Sistema Interno
- **Painel em Tempo Real:** Estatísticas de consultas diárias e mensais.
- **Gestão de Pacientes:** Cadastro completo com CPF, telefone, endereço e histórico.
- **Agenda Inteligente:** Criação de consultas com verificação automática de horários disponíveis.
- **Controle de Status:** Agendado, Confirmado, Cancelado ou Reagendamento Solicitado.
- **Configurações:** Personalização de horários de funcionamento e tokens de integração.

### Sistema Web (Clientes)
- **Agendamento Online:** Fluxo intuitivo em passos para novos pacientes.
- **Verificação de Disponibilidade:** Mostra apenas horários livres em tempo real.
- **Gestão de Consulta:** Link único para o paciente cancelar ou solicitar alteração de data/hora.

## Requisitos Técnicos
- **Sem Dependências Externas:** Não é necessário instalar Node.js ou bancos de dados complexos. Tudo roda localmente no navegador.
- **Banco de Dados Local:** Utiliza `IndexedDB`, o que significa que os dados ficam salvos de forma persistente no seu computador/navegador.

---
*Desenvolvido com foco em excelência visual e funcional para a clínica NOVO SORRISO.*
