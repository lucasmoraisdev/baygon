# Diretrizes de Projeto: Baygon

## 1. Regra de Localidade Estrita em Diagnósticos
- Se um erro ou quebra ocorrer imediatamente após a alteração de um arquivo, concentre a análise **exclusivamente no diff desse arquivo** (`git diff <arquivo>`).
- É estritamente proibido investigar camadas não tocadas (como rotas de backend, banco de dados, variáveis de ambiente ou chamadas externas) quando a falha decorrer de uma edição recente em frontend.
- Se a causa não for identificada em menos de 1 minuto, reverta ou compare diretamente com o commit funcional anterior no Git.

## 2. Validação Segura de Frontend (Next.js)
- Nunca confie no `npm run build` ou `next build` para atestar a integridade de rotas dinâmicas (`[id]`), pois o Next.js as processa dinamicamente em runtime e ignora erros sintáticos de renderização durante o build estático.
- A validação de integridade sintática e tipos do frontend deve sempre ser executada com o compilador TypeScript:
  ```bash
  .\web\node_modules\.bin\tsc.cmd --noEmit -p web/tsconfig.json
  ```

## 3. Edições Cirúrgicas e Atômicas de JSX
- Ao modificar componentes React, realize edições pequenas e bem delimitadas.
- Sempre verifique a correspondência e o fechamento correto de tags HTML/JSX antes de considerar uma alteração concluída.
