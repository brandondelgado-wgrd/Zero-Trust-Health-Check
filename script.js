// Wrap all logic in DOMContentLoaded to ensure elements are loaded
document.addEventListener('DOMContentLoaded', () => {

  let currentStep = 1;
  let partnerLogoData = null;

  // Make functions globally accessible for onclick attributes
  window.nextStep = nextStep;
  window.prevStep = prevStep;
  window.generatePDF = generatePDF;

  // Logo preview
  const partnerLogoInput = document.getElementById('partnerLogo');
  if (partnerLogoInput) {
    partnerLogoInput.addEventListener('change', function(e) {
      const file = e.target.files[0];
      if (file) {
        const reader = new FileReader();
        reader.onload = function(event) {
          partnerLogoData = event.target.result;
          const preview = document.getElementById('logoPreview');
          preview.src = partnerLogoData;
          preview.style.display = 'block';
        };
        reader.readAsDataURL(file);
      }
    });
  }

  function updateProgressBar() {
    document.querySelectorAll('.progress-step').forEach((step, index) => {
      const stepNum = index + 1;
      step.classList.remove('active', 'completed');
      
      if (stepNum < currentStep) {
        step.classList.add('completed');
      } else if (stepNum === currentStep) {
        step.classList.add('active');
      }
    });
  }

  function validateStep(step) {
    if (step === 1) {
      const partnerName = document.getElementById('partnerName').value.trim();
      const partnerPhone = document.getElementById('partnerPhone').value.trim();
      const partnerEmail = document.getElementById('partnerEmail').value.trim();
      const customerName = document.getElementById('customerName').value.trim();
      
      if (!partnerName || !partnerPhone || !partnerEmail || !customerName) {
        alert('Please fill in all required fields (Partner Name, Phone, Email, and Customer Name)');
        return false;
      }
    }
    
    if (step >= 2 && step <= 4) {
      const domainPrefix = step === 2 ? 'endpoint' : step === 3 ? 'network' : 'saas';
      let allFilled = true;
      
      for (let i = 1; i <= 5; i++) {
        const value = document.getElementById(`${domainPrefix}_${i}`).value;
        if (!value) {
          allFilled = false;
          break;
        }
      }
      
      if (!allFilled) {
        alert('Please complete all assessment items before continuing.');
        return false;
      }
    }
    
    return true;
  }

  function nextStep() {
    if (!validateStep(currentStep)) {
      return;
    }
    
    if (currentStep < 5) {
      currentStep++;
      showStep(currentStep);
      
      if (currentStep === 5) {
        calculateResults();
      }
    }
  }

  function prevStep() {
    if (currentStep > 1) {
      currentStep--;
      showStep(currentStep);
    }
  }

  function showStep(step) {
    document.querySelectorAll('.step').forEach(s => s.classList.remove('active'));
    document.querySelector(`.step[data-step="${step}"]`).classList.add('active');
    updateProgressBar();
    window.scrollTo(0, 0);
  }

  // This function calculates results *for the UI on Step 5*
  function calculateResults() {
    const { passedDomains, domainResults } = getAssessmentResults();
    
    document.getElementById('scoreDisplay').textContent = `${passedDomains} of 3 Domains Protected`;
    
    const statusHTML = domainResults.map(d => 
      `<div class="domain-badge ${d.passed ? 'pass' : 'fail'}">
        ${d.name}: ${d.passed ? 'PASSED' : 'NEEDS IMPROVEMENT'} (${d.score})
      </div>`
    ).join('');
    
    document.getElementById('domainStatus').innerHTML = statusHTML;
  }

  /**
   * Master function to gather all assessment data.
   * This is used by both the UI (calculateResults) and the PDF (generatePDF).
   */
  function getAssessmentResults() {
    const domains = ['endpoint', 'network', 'saas'];
    const domainNames = ['Endpoint Apps', 'Network Apps', 'SaaS Apps'];
    let passedDomains = 0;
    let domainResults = []; // For UI
    let allResults = {}; // For PDF
    
    const domainQuestions = {
      endpoint: [
        'Coverage: Is EDR deployed across inventory?',
        'Hardening: Are untrusted apps blocked?',
        'Authenticated: Is local MFA enabled?',
        'Detection: Can EDR detect ransomware?',
        'Response: Is auto-isolation configured?'
      ],
      network: [
        'Coverage: Perimeter firewall deployed?',
        'Hardening: Device inventory & grouping?',
        'Authenticated: User traffic authenticated?',
        'Detection: Network threats detected?',
        'Response: Incident response process?'
      ],
      saas: [
        'Coverage: All SaaS apps tracked?',
        'Hardening: App access policies exist?',
        'Authenticated: User auth to SaaS apps?',
        'Detection: Malicious URLs blocked?',
        'Response: Incident response process?'
      ]
    };

    domains.forEach((domain, index) => {
      let passes = 0;
      let results = [];
      let detailedFindings = []; // For PDF
      
      for (let i = 1; i <= 5; i++) {
        const value = document.getElementById(`${domain}_${i}`).value;
        results.push(value);
        if (value === 'PASS') passes++;
        detailedFindings.push({
          question: domainQuestions[domain][i-1],
          result: value || 'FAIL'
        });
      }
      
      const isPassed = passes >= 4; // Need 4 out of 5 to pass domain
      if (isPassed) passedDomains++;
      
      // For UI
      domainResults.push({
        name: domainNames[index],
        passed: isPassed,
        score: `${passes}/5`
      });

      // For PDF
      allResults[domain] = {
        name: domainNames[index],
        passes: passes,
        results: results,
        passed: isPassed,
        findings: detailedFindings
      };
    });

    return { passedDomains, domainResults, allResults };
  }

  /**
   * Collects all user inputs from Step 1.
   */
  function collectInputs() {
    return {
      partnerName: document.getElementById('partnerName').value,
      partnerPhone: document.getElementById('partnerPhone').value,
      partnerEmail: document.getElementById('partnerEmail').value,
      customerName: document.getElementById('customerName').value,
      logoData: partnerLogoData
    };
  }

  /**
   * Generates the standardized "Bottom Line First" PDF report.
   * This function is triggered by the "Generate PDF Report" button.
   */
  function generatePDF() {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();

    // 1. GATHER DATA
    const inputs = collectInputs();
    const results = getAssessmentResults();

    // 2. DEFINE HELPERS
    function drawBox(x, y, width, height, fill = false, fillColor = 240) {
      if (fill) {
        doc.setFillColor(fillColor, fillColor, fillColor);
        doc.rect(x, y, width, height, 'F');
      }
      doc.setDrawColor(0);
      doc.rect(x, y, width, height);
    }
    
    // *** MODIFIED FUNCTION to draw the "You Are Here" graph ***
    function drawJourneyGraph(startY, passedDomains) {
      const graphHeight = 60;
      const graphWidth = contentWidth - 10;
      const originX = margin + 10;
      const originY = startY + graphHeight;

      // Draw Axes
      doc.setLineDashPattern([1, 1], 0);
      doc.setLineWidth(0.5);
      doc.setDrawColor(150);
      // Y-Axis
      doc.line(originX, originY, originX, startY); 
      // X-Axis
      doc.line(originX, originY, originX + graphWidth, originY);
      doc.setLineDashPattern([], 0);

      // --- Y-Axis Label (CORRIGIDO) ---
      doc.setFontSize(8);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(100);

      // Dividido em três linhas para renderização estável
      const yAxisCenter = originY - (graphHeight / 2); // Ponto médio vertical
      const yAxisX = originX - 5; // Posição X (5 unidades à esquerda do eixo)
      
      // Ajuste este valor para mais ou menos espaço entre as palavras
      const labelSpacing = 15; 

      doc.text("Visibility,", yAxisX, yAxisCenter - labelSpacing, { align: 'center', angle: 90 });
      doc.text("Control,",    yAxisX, yAxisCenter,                 { align: 'center', angle: 90 });
      doc.text("Automation",  yAxisX, yAxisCenter + labelSpacing, { align: 'center', angle: 90 });
      // --- Fim da Correção ---


      // X-Axis Labels
      doc.text("Endpoint Apps", originX + (graphWidth * 0.25), originY + 5, { align: 'center' });
      doc.text("Network Apps", originX + (graphWidth * 0.5), originY + 5, { align: 'center' });
      doc.text("SaaS Apps", originX + (graphWidth * 0.75), originY + 5, { align: 'center' });

      // Draw Diagonal Path
      const endX = originX + graphWidth - 10;
      const endY = startY + 5;
      doc.setLineDashPattern([1, 1], 0);
      doc.setDrawColor(232, 20, 16); // Red path
      doc.line(originX, originY, endX, endY);
      doc.setLineDashPattern([], 0);

      // Draw Goal
      doc.setFontSize(12);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(0, 38, 99); // Dark Blue
      doc.text("Zero Trust", endX, endY - 3, { align: 'center' });

      // Calculate and Draw "You Are Here" Marker
      const totalDomains = 3;
      const progress = passedDomains / totalDomains;
      const markerX = originX + ((endX - originX) * progress);
      const markerY = originY + ((endY - originY) * progress);

      doc.setFillColor(232, 20, 16); // Red
      doc.circle(markerX, markerY, 4, 'F');
      
      doc.setFontSize(9);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(0);
      doc.text("You Are Here", markerX, markerY + 8, { align: 'center' });
      doc.setFont('helvetica', 'normal');
      doc.text(`(${passedDomains} of ${totalDomains} Domains Protected)`, markerX, markerY + 12, { align: 'center' });

      return originY + 15; // Return end Y position
    }

    const brand = 'WatchGuard';
    const pageWidth = 210;
    const pageHeight = 297;
    const margin = 20;
    const contentWidth = pageWidth - (2 * margin);
    let y = margin;

    // =========================================================================
    // 1. HEADER & TITLE
    // =========================================================================
    doc.setFontSize(20);
    doc.setFont('helvetica', 'bold');
    doc.text('Zero Trust Health Check', margin, y);
    y += 3;
    doc.setLineWidth(0.5);
    doc.line(margin, y, pageWidth - margin, y);
    y += 8;
    
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.text(`Prepared for: ${inputs.customerName || 'Customer'}`, margin, y);
    doc.text(`Prepared by: ${inputs.partnerName || 'Partner'}`, pageWidth - margin, y, { align: 'right' });
    y += 5;
    doc.text(`Date: ${new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}`, margin, y);
    y += 10;

    // =========================================================================
    // 2. EXECUTIVE SUMMARY - THE BOTTOM LINE
    // =========================================================================
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text('EXECUTIVE SUMMARY', margin, y);
    y += 8;
    
    // Recommendation
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    const recommendation = results.passedDomains === 3 ? 'RECOMMENDATION: ZT POSTURE STRONG' : 'RECOMMENDATION: REVIEW DOMAIN GAPS';
    doc.text(recommendation, margin + contentWidth / 2, y, { align: 'center' });
    y += 10;
    
    // Draw the new "You Are Here" journey graph
    y = drawJourneyGraph(y, results.passedDomains);
    y += 10; // Add padding after the graph

    // =========================================================================
    // 3. DOMAIN SCORE COMPARISON
    // =========================================================================
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text('DOMAIN SCORE COMPARISON (CHECKS PASSED)', margin, y);
    y += 8;
    
    const maxScore = 5; // 5 checks per domain
    const maxBarWidth = contentWidth - 80;
    const barHeight = 10;
    const labelWidth = 45;
    
    function drawScoreBar(label, score, yPos) {
      doc.setFontSize(9);
      doc.setFont('helvetica', 'normal');
      doc.text(label, margin, yPos + 7);
      const barWidth = (score / maxScore) * maxBarWidth;
      // Use WG-Red for the bar fill
      doc.setFillColor(232, 20, 16); 
      doc.rect(margin + labelWidth, yPos, barWidth, barHeight, 'F');
      doc.setFont('helvetica', 'bold');
      doc.text(`${score} / ${maxScore}`, margin + labelWidth + barWidth + 3, yPos + 7);
      return yPos + barHeight + 6;
    }

    y = drawScoreBar('Endpoint Apps:', results.allResults.endpoint.passes, y);
    y = drawScoreBar('Network Apps:', results.allResults.network.passes, y);
    y = drawScoreBar('SaaS Apps:', results.allResults.saas.passes, y);
    y += 10;

    // =========================================================================
    // 4. DETAILED ASSESSMENT FINDINGS
    // =========================================================================
    if (y > pageHeight - 60) {
        doc.addPage();
        y = margin;
    }
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text('DETAILED ASSESSMENT FINDINGS', margin, y);
    y += 8;

    function drawFindingsTable(domain) {
      if (y > pageHeight - 60) {
        doc.addPage();
        y = margin;
      }

      doc.setFontSize(10);
      doc.setFont('helvetica', 'bold');
      doc.text(domain.name, margin, y);
      y += 6;
      
      // Table header
      doc.setFillColor(230, 230, 230);
      doc.rect(margin, y, contentWidth, 8, 'F');
      doc.setFontSize(8);
      doc.setFont('helvetica', 'bold');
      doc.text('Audit Check', margin + 2, y + 6);
      doc.text('Result', margin + contentWidth - 20, y + 6);
      y += 8;

      // Table rows
      doc.setFont('helvetica', 'normal');
      domain.findings.forEach((item, idx) => {
        if (y > pageHeight - 20) {
          doc.addPage();
          y = margin;
        }
        const rowColor = idx % 2 === 0 ? 255 : 245;
        doc.setFillColor(rowColor, rowColor, rowColor);
        doc.rect(margin, y, contentWidth, 8, 'F');
        
        const wrappedText = doc.splitTextToSize(item.question, contentWidth - 30);
        doc.text(wrappedText, margin + 2, y + 5);
        
        const resultColor = item.result === 'PASS' ? [42, 143, 72] : [220, 53, 69];
        doc.setTextColor(...resultColor);
        doc.setFont('helvetica', 'bold');
        doc.text(item.result, margin + contentWidth - 20, y + 5);
        doc.setTextColor(0);
        doc.setFont('helvetica', 'normal');
        
        y += (wrappedText.length * 4) + 4; // Adjust height for wrapped text
      });
      y += 6;
    }

    drawFindingsTable(results.allResults.endpoint);
    drawFindingsTable(results.allResults.network);
    drawFindingsTable(results.allResults.saas);


    // =========================================================================
    // 5. BUSINESS IMPACT & BENEFITS
    // =========================================================================
    if (y > pageHeight - 60) {
      doc.addPage();
      y = margin;
    }
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text('BUSINESS IMPACT & BENEFITS OF ZERO TRUST', margin, y);
    y += 2;

    const benefitsHeight = 40;
    drawBox(margin, y, contentWidth, benefitsHeight, false);
    y += 6;

    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    
    const benefits = [
      '- Reduced Attack Surface: Enforces "least privilege" access for all users and devices.',
      '- Improved Threat Detection: Continuously validates identity and device health before granting access.',
      '- Faster Breach Containment: Automatically isolates compromised devices or users.',
      '- Simplified Compliance: Provides granular logging and access control required by regulations.',
      '- Secure Remote Work: Enables secure access to applications from any location or device.'
    ];
    
    benefits.forEach(line => {
      const wrapped = doc.splitTextToSize(line, contentWidth - 6);
      doc.text(wrapped, margin + 3, y);
      y += wrapped.length * 5 + 1.5;
    });
    y += 6;

    // =========================================================================
    // 6. YOUR SCENARIO (INPUTS)
    // =========================================================================
    if (y > pageHeight - 60) {
      doc.addPage();
      y = margin;
    }
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text('ASSESSMENT SCENARIO', margin, y);
    y += 2;
    
    const inputLines = [
      `Customer Name: ${inputs.customerName}`,
      `Partner Name: ${inputs.partnerName}`,
      `Partner Phone: ${inputs.partnerPhone}`,
      `Partner Email: ${inputs.partnerEmail}`
    ];
    
    const scenarioHeight = Math.ceil(inputLines.length / 2) * 5 + 10;
    drawBox(margin, y, contentWidth, scenarioHeight, true, 250);
    y += 6;
    
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    
    const scenario1X = margin + 3;
    const scenario2X = margin + contentWidth / 2 + 3;
    let tempY = y;
    let lineCount = 0;
    const midPoint = Math.ceil(inputLines.length / 2);
    
    for(let i = 0; i < midPoint; i++) {
        doc.text(inputLines[i], scenario1X, tempY);
        tempY += 5;
    }
    
    tempY = y;
    for(let i = midPoint; i< inputLines.length; i++) {
        doc.text(inputLines[i], scenario2X, tempY);
        tempY += 5;
    }
    
    y += scenarioHeight - 4; // Adjust spacing

    // =========================================================================
    // 7. METHODOLOGY & SOURCES
    // =========================================================================
    if (y > pageHeight - 40) {
      doc.addPage();
      y = margin;
    }
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text('METHODOLOGY & SOURCES', margin, y);
    y += 2;
    
    const methodHeight = 25;
    drawBox(margin, y, contentWidth, methodHeight, false);
    y += 6;
    
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    
    doc.text('• Domain Scoring: A domain is considered "PASSED" if it meets 4 out of 5 of the audit checks.', margin + 3, y);
    y += 6;
    doc.text('• Assessment Framework: Based on WatchGuard\'s Zero Trust principles, evaluating coverage,', margin + 3, y);
    y += 4;
    doc.text('  hardening, authentication, detection, and response across all application domains.', margin + 5, y);
    
    y += 10;
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(7);
    doc.text('Disclaimer: This health check provides a high-level assessment and is not an exhaustive security audit.', margin + 3, y);

    // --- Footer ---
    // This loops through all pages to add footer and partner logo (on page 1)
    const pageCount = doc.internal.getNumberOfPages();
    for(let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        const footerY = pageHeight - 15;
        
        doc.setFontSize(8);
        doc.setTextColor(128, 128, 128);
        doc.text(`${brand} Zero Trust Health Check`, pageWidth / 2, footerY, { align: 'center' });
        doc.setFontSize(7);
        doc.text(`Page ${i} of ${pageCount}`, pageWidth - margin, footerY, { align: 'right' });
        doc.setTextColor(0);

        // Add partner logo to first page if it exists
        if (i === 1 && inputs.logoData) {
            try {
                const imgProps = doc.getImageProperties(inputs.logoData);
                const ratio = imgProps.height / imgProps.width;
                const logoWidth = 50;
                const logoHeight = logoWidth * ratio;
                // Position logo above footer
                const logoY = pageHeight - 30 - logoHeight; 
                doc.addImage(inputs.logoData, imgProps.format || 'PNG', margin, logoY, logoWidth, logoHeight);
            } catch (e) {
                console.error('Failed to add partner logo to PDF:', e);
            }
        }
    }

    // Save PDF
    const safeName = inputs.customerName.replace(/\s+/g, '_') || 'Report';
    doc.save(`${brand}_ZT_HealthCheck_${safeName}.pdf`);
  }

  // Initial setup
  updateProgressBar();
});