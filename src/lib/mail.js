import nodemailer from 'nodemailer';

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: parseInt(process.env.SMTP_PORT),
  secure: false, // true for 465, false for other ports
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

export async function sendVerificationEmail(email, code) {
  const mailOptions = {
    from: `"JobHunt AI Pro" <${process.env.SMTP_USER}>`,
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
