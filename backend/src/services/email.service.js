const nodemailer = require('nodemailer');

function missingEmailConfig() {
  return ['EMAIL_HOST', 'EMAIL_PORT', 'EMAIL_USER', 'EMAIL_PASS', 'EMAIL_FROM']
    .filter((key) => !process.env[key]);
}

function isEmailConfigured() {
  return missingEmailConfig().length === 0;
}

async function sendEmail({ to, subject, text, attachments = [] }) {
  if (!isEmailConfigured()) {
    return { sent: false, status: 'NAO_CONFIGURADO', missing: missingEmailConfig() };
  }

  const transporter = nodemailer.createTransport({
    host: process.env.EMAIL_HOST,
    port: Number(process.env.EMAIL_PORT),
    secure: String(process.env.EMAIL_PORT) === '465',
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS,
    },
  });

  await transporter.sendMail({
    from: process.env.EMAIL_FROM,
    to,
    subject,
    text,
    attachments,
  });

  return { sent: true, status: 'ENVIADO' };
}

module.exports = { isEmailConfigured, missingEmailConfig, sendEmail };
