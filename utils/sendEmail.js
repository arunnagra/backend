const sgMail = require("@sendgrid/mail");

const sendEmail = async (email, otp, purpose = "verify your email") => {
  if (!process.env.SENDGRID_API_KEY) {
    throw new Error("SENDGRID_API_KEY is not configured. Add it to .env");
  }

  try {
    sgMail.setApiKey(process.env.SENDGRID_API_KEY);

    const msg = {
      to: email,
      from: process.env.SENDGRID_FROM_EMAIL || "noreply@gamesphere.com",
      subject:
        purpose === "reset your password"
          ? "GameSphere - Password Reset OTP"
          : "GameSphere - OTP Verification",
      html: `
        <h2>Your OTP Code</h2>
        <p>Enter this code to ${purpose}:</p>
        <h1 style="color: #007bff;">${otp}</h1>
        <p>This code expires in 5 minutes.</p>
      `,
    };

    await sgMail.send(msg);
    console.log("Email sent to:", email);
  } catch (error) {
    console.error("SendGrid email error:", error);
    throw error;
  }
};

module.exports = sendEmail;