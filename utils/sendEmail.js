const nodemailer = require("nodemailer");

const sendEmail = async (email, otp) => {
  if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
    throw new Error("Email credentials are not configured. Set EMAIL_USER and EMAIL_PASS in .env.");
  }

  try {
    const transporter = nodemailer.createTransport({
      host: "smtp.gmail.com",
      port: 587,
      secure: false,
      family: 4,
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
      },
      tls: {
        rejectUnauthorized: false,
      },
    });

    await transporter.verify();

    const mailOptions = {
      from: process.env.EMAIL_USER,
      to: email,
      subject: "OTP Verification",
      html: `
        <h2>Your OTP Code</h2>
        <h1>${otp}</h1>
      `,
    };

    await transporter.sendMail(mailOptions);
    console.log("Email Sent to:", email);
  } catch (error) {
    console.error("OTP email send failed:", error);
    throw error;
  }
};

module.exports = sendEmail;