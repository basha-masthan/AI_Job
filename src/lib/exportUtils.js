import { Document, Packer, Paragraph, TextRun, HeadingLevel } from 'docx';
import { saveAs } from 'file-saver';

export async function downloadAsDocx(resumeData, fileName = 'Resume.docx') {
  if (!resumeData) return;

  const children = [];

  // Name
  if (resumeData.name) {
    children.push(new Paragraph({
      text: resumeData.name,
      heading: HeadingLevel.HEADING_1,
      spacing: { after: 200 }
    }));
  }

  // Contact
  const c = resumeData.contact || {};
  const contactParts = [c.email, c.phone, c.location, c.linkedin, c.github, c.portfolio].filter(Boolean);
  if (contactParts.length > 0) {
    children.push(new Paragraph({
      children: [new TextRun({ text: contactParts.join('  |  '), color: '555555' })],
      spacing: { after: 400 }
    }));
  }

  // Summary
  if (resumeData.summary) {
    children.push(new Paragraph({ text: 'PROFESSIONAL SUMMARY', heading: HeadingLevel.HEADING_2, spacing: { before: 200, after: 100 } }));
    children.push(new Paragraph({ text: resumeData.summary, spacing: { after: 300 } }));
  }

  // Skills
  if (resumeData.skills && Object.keys(resumeData.skills).length > 0) {
    children.push(new Paragraph({ text: 'SKILLS', heading: HeadingLevel.HEADING_2, spacing: { before: 200, after: 100 } }));
    Object.entries(resumeData.skills).forEach(([category, skills]) => {
      const skillsText = Array.isArray(skills) ? skills.join(', ') : skills;
      if (skillsText) {
        children.push(new Paragraph({
          children: [
            new TextRun({ text: category.charAt(0).toUpperCase() + category.slice(1) + ': ', bold: true }),
            new TextRun({ text: skillsText })
          ],
          spacing: { after: 100 }
        }));
      }
    });
    children.push(new Paragraph({ spacing: { after: 200 } }));
  }

  // Experience
  if (resumeData.experience?.length > 0) {
    children.push(new Paragraph({ text: 'EXPERIENCE', heading: HeadingLevel.HEADING_2, spacing: { before: 200, after: 100 } }));
    resumeData.experience.forEach(exp => {
      children.push(new Paragraph({
        children: [
          new TextRun({ text: exp.role || '', bold: true }),
          new TextRun({ text: `  |  ${exp.company || ''}  |  ${exp.location || ''}  |  ${exp.duration || ''}`, color: '555555' })
        ],
        spacing: { before: 100, after: 100 }
      }));
      if (exp.bullets && exp.bullets.length > 0) {
        exp.bullets.forEach(bullet => {
          children.push(new Paragraph({
            text: bullet,
            bullet: { level: 0 },
            spacing: { after: 50 }
          }));
        });
      }
      children.push(new Paragraph({ spacing: { after: 100 } }));
    });
  }

  // Education
  if (resumeData.education?.length > 0) {
    children.push(new Paragraph({ text: 'EDUCATION', heading: HeadingLevel.HEADING_2, spacing: { before: 200, after: 100 } }));
    resumeData.education.forEach(edu => {
      children.push(new Paragraph({
        children: [
          new TextRun({ text: edu.degree || '', bold: true }),
          new TextRun({ text: `  |  ${edu.institution || ''}  |  ${edu.year || ''} ${edu.cgpa ? ' | CGPA: ' + edu.cgpa : ''}`, color: '555555' })
        ],
        spacing: { before: 100, after: 100 }
      }));
    });
  }

  // Projects
  if (resumeData.projects?.length > 0) {
    children.push(new Paragraph({ text: 'PROJECTS', heading: HeadingLevel.HEADING_2, spacing: { before: 200, after: 100 } }));
    resumeData.projects.forEach(proj => {
      children.push(new Paragraph({
        children: [new TextRun({ text: proj.name || '', bold: true })],
        spacing: { before: 100, after: 50 }
      }));
      if (proj.description) {
        children.push(new Paragraph({ text: proj.description, spacing: { after: 50 } }));
      }
      if (proj.tech && proj.tech.length > 0) {
        children.push(new Paragraph({
          children: [new TextRun({ text: `Technologies: ${proj.tech.join(', ')}`, italics: true, color: '666666' })],
          spacing: { after: 100 }
        }));
      }
    });
  }

  const doc = new Document({
    sections: [{
      properties: {},
      children: children
    }]
  });

  const blob = await Packer.toBlob(doc);
  saveAs(blob, fileName);
}
