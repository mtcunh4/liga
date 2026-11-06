import nodemailer from "nodemailer";

// Envio de e-mails pelo Gmail (senha de app do Google). Na Vercel: Settings › Environment Variables,
// GMAIL_USER (o endereço do Gmail) e GMAIL_SENHA_APP (a senha de app de 16 letras).
export const emailConfigurado = () => !!(process.env.GMAIL_USER && process.env.GMAIL_SENHA_APP);

export async function enviarEmail(para: string, assunto: string, html: string, texto: string) {
  const user = process.env.GMAIL_USER!.trim();
  const transporte = nodemailer.createTransport({
    host: "smtp.gmail.com", port: 465, secure: true,
    auth: { user, pass: process.env.GMAIL_SENHA_APP!.replace(/\s+/g, "") },
  });
  await transporte.sendMail({ from: `"LIGA · Painel de lançamentos" <${user}>`, to: para, subject: assunto, html, text: texto });
}
