import PDFDocument from 'pdfkit';
import path from 'path';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const require = createRequire(import.meta.url);

let _uploadFn = null;

async function getUploadFn() {
  if (!_uploadFn) {
    try {
      const mod = await import('@/lib/cloudinary');
      _uploadFn = mod.uploadToCloudinary;
    } catch (e) {
      const mod = require('./cloudinary.js');
      _uploadFn = mod.uploadToCloudinary;
    }
  }
  return _uploadFn;
}

const COLORS = {
  primary: '#1e40af',
  secondary: '#475569',
  accent: '#0891b2',
  text: '#0f172a',
  muted: '#64748b',
  border: '#cbd5e1',
  bgLight: '#f1f5f9',
};

const FONTS = {
  bold: 'Helvetica-Bold',
  regular: 'Helvetica',
  oblique: 'Helvetica-Oblique',
};

function pickHex(color) {
  if (typeof color !== 'string') return COLORS.text;
  if (color.startsWith('#')) return color;
  return COLORS.text;
}

function hr(doc, y, color = COLORS.border) {
  doc.save().strokeColor(pickHex(color)).lineWidth(0.5).moveTo(doc.page.margins.left, y).lineTo(doc.page.width - doc.page.margins.right, y).stroke().restore();
}

function sectionHeader(doc, title, y) {
  doc.fillColor(COLORS.primary).font(FONTS.bold).fontSize(12).text(title.toUpperCase(), doc.page.margins.left, y);
  const textY = doc.y;
  doc.fillColor(COLORS.text).font(FONTS.regular).fontSize(10);
  return textY + 4;
}

function ensureSpace(doc, needed) {
  if (doc.y + needed > doc.page.height - doc.page.margins.bottom) {
    doc.addPage();
  }
}

function renderContact(doc, contact) {
  if (!contact) return;
  const items = [];
  if (contact.email) items.push(contact.email);
  if (contact.phone) items.push(contact.phone);
  if (contact.location) items.push(contact.location);
  if (contact.linkedin) items.push(contact.linkedin);
  if (contact.github) items.push(contact.github);
  if (contact.portfolio) items.push(contact.portfolio);

  if (items.length === 0) return;

  doc.fillColor(COLORS.secondary).font(FONTS.regular).fontSize(9);
  const line = items.join('  ·  ');
  doc.text(line, { align: 'center', width: doc.page.width - doc.page.margins.left - doc.page.margins.right });
  doc.moveDown(0.3);
}

function renderSkills(doc, skills) {
  if (!skills) return;
  const groups = [];
  if (Array.isArray(skills.technical) && skills.technical.length) groups.push({ label: 'Technical', items: skills.technical });
  if (Array.isArray(skills.soft) && skills.soft.length) groups.push({ label: 'Soft Skills', items: skills.soft });
  if (Array.isArray(skills.tools) && skills.tools.length) groups.push({ label: 'Tools', items: skills.tools });

  if (groups.length === 0) return;

  ensureSpace(doc, 40);
  let y = sectionHeader(doc, 'Skills', doc.y);
  doc.y = y;

  for (const group of groups) {
    ensureSpace(doc, 18);
    doc.fillColor(COLORS.accent).font(FONTS.bold).fontSize(10).text(`${group.label}: `, { continued: true });
    doc.fillColor(COLORS.text).font(FONTS.regular).fontSize(10).text(group.items.join(', '));
    doc.moveDown(0.2);
  }
  doc.moveDown(0.4);
}

function renderExperience(doc, experience) {
  if (!Array.isArray(experience) || experience.length === 0) return;
  ensureSpace(doc, 40);
  let y = sectionHeader(doc, 'Experience', doc.y);
  doc.y = y;

  for (const exp of experience) {
    ensureSpace(doc, 30);
    const headerLine = [exp.role, exp.company].filter(Boolean).join(' — ');
    doc.fillColor(COLORS.text).font(FONTS.bold).fontSize(11).text(headerLine);
    const meta = [exp.duration, exp.location].filter(Boolean).join(' · ');
    if (meta) {
      doc.fillColor(COLORS.muted).font(FONTS.oblique).fontSize(9).text(meta);
    }
    doc.moveDown(0.2);

    if (Array.isArray(exp.bullets)) {
      for (const bullet of exp.bullets) {
        ensureSpace(doc, 12);
        doc.fillColor(COLORS.text).font(FONTS.regular).fontSize(10)
          .text(`• ${bullet}`, { indent: 10, paragraphGap: 2 });
      }
    }
    doc.moveDown(0.4);
  }
}

function renderEducation(doc, education) {
  if (!Array.isArray(education) || education.length === 0) return;
  ensureSpace(doc, 30);
  let y = sectionHeader(doc, 'Education', doc.y);
  doc.y = y;

  for (const edu of education) {
    ensureSpace(doc, 18);
    const line = [edu.degree, edu.institution].filter(Boolean).join(' — ');
    doc.fillColor(COLORS.text).font(FONTS.bold).fontSize(10).text(line);
    const meta = [edu.year, edu.cgpa ? `CGPA: ${edu.cgpa}` : null].filter(Boolean).join(' · ');
    if (meta) {
      doc.fillColor(COLORS.muted).font(FONTS.regular).fontSize(9).text(meta);
    }
    doc.moveDown(0.3);
  }
}

function renderProjects(doc, projects) {
  if (!Array.isArray(projects) || projects.length === 0) return;
  ensureSpace(doc, 30);
  let y = sectionHeader(doc, 'Projects', doc.y);
  doc.y = y;

  for (const project of projects) {
    ensureSpace(doc, 24);
    if (project.name) {
      doc.fillColor(COLORS.text).font(FONTS.bold).fontSize(10).text(project.name, { continued: !!project.description });
      if (project.description) {
        doc.fillColor(COLORS.text).font(FONTS.regular).fontSize(10).text(`: ${project.description}`);
      } else {
        doc.text('');
      }
    } else if (project.description) {
      doc.fillColor(COLORS.text).font(FONTS.regular).fontSize(10).text(project.description);
    }

    if (Array.isArray(project.tech) && project.tech.length) {
      doc.fillColor(COLORS.accent).font(FONTS.regular).fontSize(9).text(`Tech: ${project.tech.join(', ')}`, { indent: 10 });
    }
    if (project.link) {
      doc.fillColor(COLORS.muted).font(FONTS.oblique).fontSize(9).text(project.link, { indent: 10 });
    }
    doc.moveDown(0.3);
  }
}

function renderCertifications(doc, certs) {
  if (!Array.isArray(certs) || certs.length === 0) return;
  ensureSpace(doc, 30);
  let y = sectionHeader(doc, 'Certifications', doc.y);
  doc.y = y;
  for (const c of certs) {
    ensureSpace(doc, 12);
    doc.fillColor(COLORS.text).font(FONTS.regular).fontSize(10).text(`• ${c}`);
  }
  doc.moveDown(0.4);
}

function renderAchievements(doc, achievements) {
  if (!Array.isArray(achievements) || achievements.length === 0) return;
  ensureSpace(doc, 30);
  let y = sectionHeader(doc, 'Achievements', doc.y);
  doc.y = y;
  for (const a of achievements) {
    ensureSpace(doc, 12);
    doc.fillColor(COLORS.text).font(FONTS.regular).fontSize(10).text(`• ${a}`);
  }
  doc.moveDown(0.4);
}

export function generateResumePDF(resumeData) {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({
        size: 'LETTER',
        margins: { top: 50, bottom: 50, left: 50, right: 50 },
        info: {
          Title: `${resumeData?.name || 'Resume'} — ${resumeData?.jobTitle || 'Tailored Resume'}`,
          Author: resumeData?.name || 'Job Hunt Pro',
          Subject: 'AI-Generated Tailored Resume',
        },
      });

      const chunks = [];
      doc.on('data', chunk => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      const data = resumeData?.data || resumeData || {};
      const contact = data.contact || {};

      doc.fillColor(COLORS.primary).font(FONTS.bold).fontSize(22)
        .text((data.name || 'Your Name').toUpperCase(), { align: 'center' });
      let roleName = data.jobTitle || data.targetRole || data.role;
      if (!roleName || 
          roleName.toLowerCase().trim() === 'target role' || 
          roleName.toLowerCase().trim() === 'target job title' || 
          roleName.toLowerCase().trim() === 'untitled role' || 
          roleName.toLowerCase().trim() === 'tailored role') {
        roleName = data.experience?.[0]?.role || 'Software Developer';
      }
      doc.fillColor(COLORS.secondary).font(FONTS.regular).fontSize(12)
        .text(roleName, { align: 'center' });
      doc.moveDown(0.3);

      renderContact(doc, contact);
      hr(doc, doc.y);
      doc.moveDown(0.5);

      if (data.summary) {
        ensureSpace(doc, 60);
        let y = sectionHeader(doc, 'Summary', doc.y);
        doc.y = y;
        doc.fillColor(COLORS.text).font(FONTS.regular).fontSize(10)
          .text(data.summary, { align: 'justify' });
        doc.moveDown(0.5);
      }

      renderSkills(doc, data.skills);
      renderExperience(doc, data.experience);
      renderProjects(doc, data.projects);
      renderEducation(doc, data.education);
      renderCertifications(doc, data.certifications);
      renderAchievements(doc, data.achievements);

      doc.end();
    } catch (err) {
      reject(err);
    }
  });
}

export async function uploadResumePDFToCloudinary(pdfBuffer, publicIdBase) {
  const upload = await getUploadFn();
  return upload(pdfBuffer, publicIdBase, 'raw');
}

export async function generateAndUploadResumePDF(resumeData, publicIdBase) {
  const pdfBuffer = await generateResumePDF(resumeData);
  const result = await uploadResumePDFToCloudinary(pdfBuffer, publicIdBase);
  return { pdfBuffer, cloudinaryResult: result };
}
