import nodemailer from 'nodemailer';

function createTransporter() {
  const host = process.env.SMTP_HOST || 'smtp.gmail.com';
  const port = parseInt(process.env.SMTP_PORT || '587');
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;

  if (!user || !pass) {
    throw new Error('SMTP credentials not configured. Set SMTP_USER and SMTP_PASS environment variables.');
  }

  return nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: { user, pass },
    connectionTimeout: 10000,
    greetingTimeout: 10000,
    socketTimeout: 15000,
  });
}

export async function sendVerificationEmail(email, code) {
  const transporter = createTransporter();
  const fromEmail = process.env.SMTP_USER || 'noreply@jobhuntai.com';

  const mailOptions = {
    from: `"JobHunt AI Pro" <${fromEmail}>`,
    to: email,
    subject: 'Verify your email - JobHunt AI Pro',
    html: `
      <div style="font-family: sans-serif; max-width: 600px; margin: auto; padding: 20px; border: 1px solid #eee; border-radius: 10px;">
        <h2 style="color: #6366f1;">Welcome to JobHunt AI Pro!</h2>
        <p>Please use the verification code below to complete your registration:</p>
        <div style="background: #f3f4f6; padding: 20px; text-align: center; font-size: 32px; font-weight: 800; letter-spacing: 5px; color: #1f2937; border-radius: 8px;">
          ${code}
        </div>
        <p style="margin-top: 20px; color: #6b7280; font-size: 14px;">If you didn't request this, you can safely ignore this email.</p>
      </div>
    `,
  };

  return await transporter.sendMail(mailOptions);
}
