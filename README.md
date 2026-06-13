# Rede Vizinhos IA - Frontend

Interface web responsiva da Rede Vizinhos IA. Permite registrar alertas,
consultar relatos, aplicar filtros e acompanhar a situacao por regiao.

## Tecnologias

- React
- Vite
- CSS responsivo e mobile-first
- Fetch API

## Configuracao

Crie o arquivo local de ambiente:

```powershell
Copy-Item .env.example .env
```

Defina a URL publica do backend, sem `/api/alertas` no final:

```env
VITE_API_URL=http://localhost:8000
```

No Vercel, cadastre `VITE_API_URL` nas Environment Variables com a URL do
backend publicado e gere um novo deploy.

## Executar localmente

```powershell
npm install
npm run dev
```

O Vite normalmente disponibiliza a aplicacao em `http://localhost:5173`.

## Build

```powershell
npm run build
npm run preview
```

Os arquivos de producao sao gerados em `dist/`.

## Git

```powershell
git init
git add .
git commit -m "feat: adiciona frontend Rede Vizinhos IA"
git branch -M main
git remote add origin URL_DO_REPOSITORIO_FRONTEND
git push -u origin main
```
