Passo 1 — Criar o bot no @BotFather
Abre o Telegram (app ou web: web.telegram.org)

Na busca, digita @BotFather (com @) — é a conta oficial verificada do Telegram pra criar bots

Manda /start → ele responde com um menu

Manda /newbot

Ele pergunta o nome do bot (display name, pode ser qualquer coisa em qualquer idioma):


Bot Promoções Teste
Ele pergunta o username do bot (precisa terminar em bot ou _bot, único globalmente):


afiliado_analytics_test_bot
Se o nome estiver em uso, ele recusa e pede outro.

Ele responde com o token — algo assim:


Done! Congratulations on your new bot. ...
Use this token to access the HTTP API:
8123456789:AAFm-XYZabc1234567890DEFghIJklMNopqRS

Keep your token secure and store it safely
Copia esse token e guarda. É o que você vai colar no nosso app.

Passo 2 — Desativar Privacy Mode (importante!)
Por padrão, bots só "veem" mensagens direcionadas a eles (menções, comandos). Pra nosso webhook descobrir grupos via mensagens normais, precisa desativar:

Volta pro @BotFather
Manda /setprivacy
Ele lista seus bots → escolhe o que você acabou de criar
Manda Disable
Pronto. Agora o bot recebe TODAS as mensagens dos grupos onde estiver.