"""
Templates de E-mail para a Associação Baygon.
Segue o design system da plataforma (Stripe-inspired / Dark & Light slate, acentos em azul #2563eb,
tipografia limpa e compatibilidade robusta com múltiplos clientes de e-mail).
"""

from typing import Optional


def _get_base_email_layout(
    preheader: str,
    badge_label: str,
    title: str,
    body_html: str,
    cta_text: Optional[str] = None,
    cta_url: Optional[str] = None,
    info_box_html: Optional[str] = None,
    footer_note: Optional[str] = None,
) -> str:
    """
    Layout base responsivo e à prova de falhas (Bulletproof HTML email)
    compatível com Outlook, Gmail, Apple Mail, Yahoo e clientes mobile/web.
    """
    button_html = ""
    alt_url_html = ""
    if cta_text and cta_url:
        button_html = f"""
        <table role="presentation" border="0" cellpadding="0" cellspacing="0" style="margin: 28px 0 20px 0; width: 100%;">
            <tr>
                <td align="center">
                    <!--[if mso]>
                    <v:roundrect xmlns:v="urn:schemas-microsoft-com:vml" xmlns:w="urn:schemas-microsoft-com:office:word" href="{cta_url}" style="height:48px;v-text-anchor:middle;width:240px;" arcsize="20%" stroke="f" fillcolor="#2563eb">
                    <w:anchorlock/>
                    <center style="color:#ffffff;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;font-size:15px;font-weight:bold;">{cta_text}</center>
                    </v:roundrect>
                    <![endif]-->
                    <!--[if !mso]><!-->
                    <a href="{cta_url}" target="_blank" style="display: inline-block; background-color: #2563eb; color: #ffffff; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; font-size: 15px; font-weight: 600; text-decoration: none; padding: 14px 32px; border-radius: 10px; box-shadow: 0 4px 12px rgba(37, 99, 235, 0.25); text-align: center; mso-padding-alt: 0;">
                        {cta_text}
                    </a>
                    <!--<![endif]-->
                </td>
            </tr>
        </table>
        """
        alt_url_html = f"""
        <table role="presentation" border="0" cellpadding="0" cellspacing="0" style="width: 100%; margin-top: 16px; border-top: 1px solid #f1f5f9; padding-top: 16px;">
            <tr>
                <td>
                    <p style="margin: 0 0 6px 0; font-size: 12px; color: #94a3b8; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.4;">
                        Se o botão acima não funcionar, copie e cole o link abaixo no seu navegador:
                    </p>
                    <p style="margin: 0; font-size: 12px; word-break: break-all; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
                        <a href="{cta_url}" target="_blank" style="color: #2563eb; text-decoration: underline;">{cta_url}</a>
                    </p>
                </td>
            </tr>
        </table>
        """

    info_box_section = ""
    if info_box_html:
        info_box_section = f"""
        <div style="margin: 24px 0;">
            {info_box_html}
        </div>
        """

    footer_note_html = ""
    if footer_note:
        footer_note_html = f"""
        <p style="margin: 16px 0 0 0; font-size: 13px; color: #64748b; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.5;">
            {footer_note}
        </p>
        """

    return f"""<!DOCTYPE html>
<html lang="pt-BR">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta http-equiv="X-UA-Compatible" content="IE=edge">
    <meta name="x-apple-disable-message-reformatting">
    <title>{title}</title>
    <!--[if mso]>
    <noscript>
        <xml>
            <o:OfficeDocumentSettings>
                <o:PixelsPerInch>96</o:PixelsPerInch>
            </o:OfficeDocumentSettings>
        </xml>
    </noscript>
    <![endif]-->
    <style>
        html, body {{
            margin: 0 !important;
            padding: 0 !important;
            height: 100% !important;
            width: 100% !important;
            background-color: #070b14;
        }}
        * {{
            -ms-text-size-adjust: 100%;
            -webkit-text-size-adjust: 100%;
        }}
        table, td {{
            mso-table-lspace: 0pt !important;
            mso-table-rspace: 0pt !important;
        }}
        table {{
            border-spacing: 0 !important;
            border-collapse: collapse !important;
            table-layout: fixed !important;
            margin: 0 auto !important;
        }}
        img {{
            -ms-interpolation-mode: bicubic;
        }}
        a {{
            text-decoration: none;
        }}
        @media screen and (max-width: 600px) {{
            .email-container {{
                width: 100% !important;
                margin: auto !important;
            }}
            .card-body {{
                padding: 24px 20px !important;
            }}
            .header-padding {{
                padding: 24px 20px 20px 20px !important;
            }}
        }}
        @media (prefers-color-scheme: dark) {{
            body, .bg-outer {{
                background-color: #070b14 !important;
            }}
            .card-content {{
                background-color: #0d1527 !important;
                border-color: rgba(255, 255, 255, 0.1) !important;
            }}
            .text-title {{
                color: #f8fafc !important;
            }}
            .text-body {{
                color: #cbd5e1 !important;
            }}
            .box-credentials {{
                background-color: #111a2e !important;
                border-color: rgba(37, 99, 235, 0.3) !important;
            }}
            .box-code {{
                background-color: #070b14 !important;
                color: #60a5fa !important;
                border-color: rgba(255, 255, 255, 0.12) !important;
            }}
        }}
    </style>
</head>
<body width="100%" style="margin: 0; padding: 0 !important; mso-line-height-rule: exactly; background-color: #070b14;">
    <!-- Preheader Oculto para pré-visualização em clientes de e-mail -->
    <div style="display: none; font-size: 1px; line-height: 1px; max-height: 0px; max-width: 0px; opacity: 0; overflow: hidden; mso-hide: all; font-family: sans-serif;">
        {preheader}
    </div>

    <center style="width: 100%; background-color: #070b14; text-align: left;">
        <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" class="bg-outer" style="background-color: #070b14; width: 100%;">
            <tr>
                <td align="center" style="padding: 36px 16px;">
                    <!-- Container Principal (largura máxima 560px) -->
                    <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" class="email-container" style="max-width: 560px; margin: 0 auto;">
                        
                        <!-- Header com Identidade Visual Baygon -->
                        <tr>
                            <td align="center" class="header-padding" style="padding: 10px 24px 28px 24px;">
                                <table role="presentation" border="0" cellpadding="0" cellspacing="0">
                                    <tr>
                                        <td align="center">
                                            <!-- Escudo / Badge da Associação -->
                                            <table role="presentation" border="0" cellpadding="0" cellspacing="0" style="margin-bottom: 12px;">
                                                <tr>
                                                    <td style="background: linear-gradient(135deg, #2563eb, #1d4ed8); width: 44px; height: 44px; border-radius: 12px; text-align: center; vertical-align: middle; box-shadow: 0 4px 14px rgba(37, 99, 235, 0.35);">
                                                        <span style="font-size: 22px; line-height: 44px; display: block;">⚽</span>
                                                    </td>
                                                </tr>
                                            </table>
                                            <h1 style="margin: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; font-size: 19px; font-weight: 800; color: #f8fafc; letter-spacing: 0.05em; text-transform: uppercase;">
                                                Associação Baygon
                                            </h1>
                                            <p style="margin: 4px 0 0 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; font-size: 11px; font-weight: 600; color: #60a5fa; letter-spacing: 0.12em; text-transform: uppercase;">
                                                {badge_label}
                                            </p>
                                        </td>
                                    </tr>
                                </table>
                            </td>
                        </tr>

                        <!-- Card de Conteúdo Principal -->
                        <tr>
                            <td class="card-content" style="background-color: #ffffff; border: 1px solid #e2e8f0; border-radius: 16px; box-shadow: 0 10px 25px rgba(0, 0, 0, 0.25); overflow: hidden;">
                                <!-- Faixa Decorativa no Topo do Card -->
                                <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%">
                                    <tr>
                                        <td style="background: linear-gradient(90deg, #2563eb, #3b82f6, #60a5fa); height: 4px; font-size: 1px; line-height: 1px;">&nbsp;</td>
                                    </tr>
                                </table>

                                <!-- Corpo do Card -->
                                <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%">
                                    <tr>
                                        <td class="card-body" style="padding: 36px 32px 32px 32px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
                                            <h2 class="text-title" style="margin: 0 0 16px 0; font-size: 22px; font-weight: 700; color: #0f172a; line-height: 1.3;">
                                                {title}
                                            </h2>

                                            <div class="text-body" style="font-size: 15px; line-height: 1.6; color: #334155;">
                                                {body_html}
                                            </div>

                                            {info_box_section}

                                            {button_html}

                                            {footer_note_html}

                                            {alt_url_html}
                                        </td>
                                    </tr>
                                </table>
                            </td>
                        </tr>

                        <!-- Rodapé Institucional -->
                        <tr>
                            <td align="center" style="padding: 32px 20px 20px 20px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
                                <p style="margin: 0 0 8px 0; font-size: 12px; color: #64748b; line-height: 1.5;">
                                    <strong>Associação Baygon</strong> &bull; Gestão do Baba, Estatísticas e Ranking
                                </p>
                                <p style="margin: 0; font-size: 11px; color: #475569; line-height: 1.5;">
                                    Este é um e-mail transacional automático enviado pelo sistema. Por favor, não responda a esta mensagem.
                                </p>
                            </td>
                        </tr>

                    </table>
                </td>
            </tr>
        </table>
    </center>
</body>
</html>"""


def render_invite_email(invite_link: str, default_password: str) -> str:
    """
    Gera o HTML do e-mail de convite e ativação de novo usuário.
    """
    preheader = "Você foi convidado para a Associação Baygon! Ative sua conta e defina sua senha."
    badge_label = "Gestão de Futebol & Estatísticas"
    title = "Bem-vindo ao Baygon!"

    body_html = """
    <p style="margin: 0 0 14px 0;">
        Você foi convidado para fazer parte da plataforma oficial da <strong>Associação Baygon</strong>.
    </p>
    <p style="margin: 0 0 14px 0;">
        Por aqui você poderá acompanhar seus gols, assistências, cartões, pontuações de ranking,
        escalações de times das rodadas e muito mais.
    </p>
    <p style="margin: 0;">
        Para ativar sua conta e liberar seu acesso, utilize o botão abaixo para confirmar seu e-mail e definir sua senha definitiva:
    </p>
    """

    info_box_html = f"""
    <table role="presentation" border="0" cellpadding="0" cellspacing="0" class="box-credentials" width="100%" style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-left: 4px solid #2563eb; border-radius: 10px; padding: 16px;">
        <tr>
            <td>
                <p style="margin: 0 0 6px 0; font-size: 13px; font-weight: 700; color: #1e293b; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
                    🔐 Sua Senha Inicial Temporária:
                </p>
                <div class="box-code" style="background-color: #ffffff; border: 1px solid #cbd5e1; border-radius: 8px; padding: 10px 14px; font-family: 'SFMono-Regular', Consolas, 'Liberation Mono', Menlo, Courier, monospace; font-size: 18px; font-weight: 700; color: #2563eb; letter-spacing: 2px; text-align: center; margin: 8px 0;">
                    {default_password}
                </div>
                <p style="margin: 6px 0 0 0; font-size: 12px; color: #64748b; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.4;">
                    <strong>Importante:</strong> Esta é uma senha temporária gerada pelo sistema. Você definirá sua senha pessoal ao completar o cadastro pelo link.
                </p>
            </td>
        </tr>
    </table>
    """

    footer_note = "⏱ <strong>Atenção:</strong> Por motivos de segurança, este link de convite é válido por <strong>24 horas</strong>. Se você não esperava este convite, pode desconsiderar esta mensagem."

    return _get_base_email_layout(
        preheader=preheader,
        badge_label=badge_label,
        title=title,
        body_html=body_html,
        cta_text="Completar Meu Cadastro →",
        cta_url=invite_link,
        info_box_html=info_box_html,
        footer_note=footer_note,
    )


def render_password_reset_email(reset_link: str) -> str:
    """
    Gera o HTML do e-mail de redefinição / recuperação de senha.
    """
    preheader = "Solicitação de redefinição de senha da sua conta na Associação Baygon."
    badge_label = "Segurança da Conta"
    title = "Redefinição de Senha"

    body_html = """
    <p style="margin: 0 0 14px 0;">
        Recebemos uma solicitação para redefinir a senha da sua conta na <strong>Associação Baygon</strong>.
    </p>
    <p style="margin: 0;">
        Para cadastrar uma nova senha e restabelecer seu acesso, clique no botão seguro abaixo:
    </p>
    """

    info_box_html = """
    <table role="presentation" border="0" cellpadding="0" cellspacing="0" class="box-credentials" width="100%" style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-left: 4px solid #f59e0b; border-radius: 10px; padding: 14px 16px;">
        <tr>
            <td>
                <p style="margin: 0; font-size: 13px; color: #475569; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.5;">
                    🛡 <strong>Dica de Segurança:</strong> Crie uma senha com pelo menos 6 caracteres, combinando letras e números. Nunca compartilhe sua senha com terceiros.
                </p>
            </td>
        </tr>
    </table>
    """

    footer_note = "⏱ <strong>Atenção:</strong> Este link de redefinição é de uso único e expira em <strong>24 horas</strong>. Se você <strong>não</strong> solicitou a alteração de senha, ignore este e-mail — sua conta e senha atual permanecerão totalmente seguras."

    return _get_base_email_layout(
        preheader=preheader,
        badge_label=badge_label,
        title=title,
        body_html=body_html,
        cta_text="Redefinir Minha Senha →",
        cta_url=reset_link,
        info_box_html=info_box_html,
        footer_note=footer_note,
    )
