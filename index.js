const express = require("express");
const cors = require("cors");
const fs = require("fs");
const path = require("path");
const nodemailer = require("nodemailer");
require("dotenv").config();

const app = express();
const PORT = process.env.PORT || 5000;

// Enable CORS for frontend requests
app.use(
  cors({
    origin: process.env.FRONTEND_URL || "http://localhost:3000",
    methods: ["GET", "POST"],
    credentials: true,
  })
);

app.use(express.json());

const INQUIRIES_FILE = path.join(__dirname, "inquiries.json");

// Ensure inquiries.json exists
if (!fs.existsSync(INQUIRIES_FILE)) {
  fs.writeFileSync(INQUIRIES_FILE, JSON.stringify([], null, 2));
}

// Configure email transporter
const transporter = nodemailer.createTransport({
  service: process.env.EMAIL_SERVICE || "gmail",
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

// Health check endpoint
app.get("/health", (req, res) => {
  res.status(200).json({ status: "OK", timestamp: new Date() });
});

// Contact/Project submission endpoint
app.post("/api/contact", (req, res) => {
  const { name, email, company, message, projectType, budget } = req.body;

  // Simple validation
  if (!name || !email || !message) {
    return res.status(400).json({
      success: false,
      message: "Required fields are missing (name, email, and message are required).",
    });
  }

  const newInquiry = {
    id: Date.now().toString(),
    name,
    email,
    company: company || "",
    message,
    projectType: projectType || "General Contact",
    budget: budget || "Not specified",
    createdAt: new Date().toISOString(),
  };

  try {
    // Read current data
    const fileData = fs.readFileSync(INQUIRIES_FILE, "utf8");
    const inquiries = JSON.parse(fileData);

    // Add new data
    inquiries.push(newInquiry);

    // Write back
    fs.writeFileSync(INQUIRIES_FILE, JSON.stringify(inquiries, null, 2));

    console.log(`[New Inquiry Saved]: ${name} (${email}) - ${projectType}`);

    // Try sending email if configured
    if (process.env.EMAIL_USER && process.env.EMAIL_PASS) {
      const mailOptions = {
        from: `"${name} (via Tsquare Innovations)" <${process.env.EMAIL_USER}>`,
        replyTo: email,
        to: process.env.RECEIVER_EMAIL || "tsquareinnovations.info@gmail.com",
        subject: `New Inquiry: ${projectType} from ${name}`,
        html: `
          <h3>New Project Inquiry / Message</h3>
          <p><strong>Name:</strong> ${name}</p>
          <p><strong>Email:</strong> ${email}</p>
          <p><strong>Company:</strong> ${company || "N/A"}</p>
          <p><strong>Project Type:</strong> ${projectType}</p>
          <p><strong>Budget:</strong> ${budget}</p>
          <p><strong>Message:</strong></p>
          <p>${message.replace(/\n/g, "<br>")}</p>
        `,
      };

      transporter.sendMail(mailOptions, (error, info) => {
        if (error) {
          console.error("Error sending email notification:", error);
        } else {
          console.log("Email notification sent successfully:", info.response);
        }
      });
    } else {
      console.log(
        "Email notification skipped: EMAIL_USER and EMAIL_PASS environment variables are not set in the backend .env file."
      );
    }

    return res.status(201).json({
      success: true,
      message: "Your inquiry has been successfully received!",
      data: newInquiry,
    });
  } catch (error) {
    console.error("Error saving inquiry:", error);
    return res.status(500).json({
      success: false,
      message: "An internal server error occurred while processing your request.",
    });
  }
});

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
