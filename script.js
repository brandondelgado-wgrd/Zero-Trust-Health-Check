// Wrap all logic in DOMContentLoaded to ensure elements are loaded
document.addEventListener('DOMContentLoaded', () => {

  // --- TEST CODE TO AUTO-FILL "PASS" ---
  // Find all select elements with the class "assessment-field" and set their value to "PASS"
  document.querySelectorAll('.assessment-field').forEach(selectElement => {
    selectElement.value = 'PASS';
  });
  // --- END TEST CODE ---

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
          
          // Load image to get original dimensions and calculate optimal size
          const img = new Image();
          img.onload = function() {
            const maxWidth = 225.48;
            const maxHeight = 108.17;
            let width = img.naturalWidth;
            let height = img.naturalHeight;
            
            // Calculate aspect ratio
            const aspectRatio = width / height;
            
            // Scale to fit within max dimensions while maintaining aspect ratio
            if (width > maxWidth || height > maxHeight) {
              if (width / maxWidth > height / maxHeight) {
                // Width is the limiting factor
                width = maxWidth;
                height = width / aspectRatio;
              } else {
                // Height is the limiting factor
                height = maxHeight;
                width = height * aspectRatio;
              }
            }
            
            // Apply calculated dimensions to preview
            preview.style.width = width + 'px';
            preview.style.height = height + 'px';
            preview.style.objectFit = 'contain';
            preview.style.display = 'block';
          };
          img.src = partnerLogoData;
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
      const yourName = document.getElementById('yourName').value.trim();
      const yourRole = document.getElementById('yourRole').value.trim();
      const partnerPhone = document.getElementById('partnerPhone').value.trim();
      const partnerEmail = document.getElementById('partnerEmail').value.trim();
      const customerName = document.getElementById('customerName').value.trim();
      
      if (!partnerName || !yourName || !yourRole || !partnerPhone || !partnerEmail || !customerName) {
        alert('Please fill in all required fields.');
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

  /**
   * MODIFIED FUNCTION
   * Adds logic to reset the Step 5 buttons if the user navigates back.
   */
  function prevStep() {
    if (currentStep > 1) {
      currentStep--;
      showStep(currentStep);

      // --- START OF MODIFICATION ---
      // If we left step 5, reset the buttons
      if (currentStep < 5) {
        const genContainer = document.getElementById('generate-container');
        const dlContainer = document.getElementById('download-container');
        
        if (genContainer && dlContainer) {
          // Show the generate button
          genContainer.style.display = 'flex';
          // Hide the download button
          dlContainer.style.display = 'none';
          // Clear the old link
          document.getElementById('download-pdf-link').href = '#'; 
        }
      }
      // --- END OF MODIFICATION ---
    }
  }

  function showStep(step) {
    document.querySelectorAll('.step').forEach(s => s.classList.remove('active'));
    document.querySelector(`.step[data-step="${step}"]`).classList.add('active');
    updateProgressBar();
    window.scrollTo(0, 0);
  }

  // This function calculates the results for the UI (Step 5)
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
   * Master function to collect all assessment data.
   */
  function getAssessmentResults() {
    const domains = ['endpoint', 'network', 'saas'];
    const domainNames = ['Endpoint Apps', 'Network Apps', 'SaaS Apps'];
    let passedDomains = 0;
  let domainResults = []; // For UI
  let allResults = {}; // For webhook payload
    
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
      let detailedFindings = [];
      
      for (let i = 1; i <= 5; i++) {
        const value = document.getElementById(`${domain}_${i}`).value;
        results.push(value);
        if (value === 'PASS') passes++;
        detailedFindings.push({
          question: domainQuestions[domain][i-1],
          result: value || 'FAIL'
        });
      }
      
  const isPassed = passes >= 4; // Needs 4 out of 5 to pass
      if (isPassed) passedDomains++;
      
  // For UI
      domainResults.push({
        name: domainNames[index],
        passed: isPassed,
        score: `${passes}/5`
      });

  // For webhook
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
   * Collect all Step 1 inputs
   */
  function collectInputs() {
    return {
      partnerName: document.getElementById('partnerName').value,
      yourName: document.getElementById('yourName').value,
      yourRole: document.getElementById('yourRole').value,
      partnerPhone: document.getElementById('partnerPhone').value,
      partnerEmail: document.getElementById('partnerEmail').value,
      customerName: document.getElementById('customerName').value
    };
  }

  /**
   * MODIFIED FUNCTION
   * Sends all data to the webhook and controls display of the new button containers.
   */
  async function generatePDF() {
    // Try to find a button element to show loading state. The HTML may not
    // include an ID, so fall back to a selector for the inline onclick.
    const button = document.getElementById('generate-pdf-btn')
      || document.querySelector('button[onclick="generatePDF()"]')
      || document.querySelector('.btn-primary[onclick="generatePDF()"]')
      || null;

    const originalText = button && button.textContent ? button.textContent : '';

    try {
      if (button) {
        button.disabled = true;
        button.innerHTML = '<span style="display: inline-block; animation: spin 1s linear infinite;">⏳</span> Generating PDF Report...';
      }

      const inputs = collectInputs();
      const results = getAssessmentResults();

  // Prepare the payload with all data (unchanged)
      const payload = {
        formData: {
          partnerName: inputs.partnerName,
          yourName: inputs.yourName,
          yourRole: inputs.yourRole,
          partnerPhone: inputs.partnerPhone,
          partnerEmail: inputs.partnerEmail,
          customerName: inputs.customerName,
          assessmentDate: new Date().toLocaleDateString('pt-BR')
        },
        logoBase64: partnerLogoData,
        summary: {
          passedDomains: results.passedDomains,
          totalDomains: 3
        },
        domains: {
          endpoint: {
            name: 'Endpoint Apps',
            passed: results.allResults.endpoint.passed,
            totalPasses: results.allResults.endpoint.passes,
            totalQuestions: 5,
            items: results.allResults.endpoint.findings.map(f => ({
              question: f.question,
              result: f.result,
              points: f.result === 'PASS' ? 1 : 0
            }))
          },
          network: {
            name: 'Network Apps',
            passed: results.allResults.network.passed,
            totalPasses: results.allResults.network.passes,
            totalQuestions: 5,
            items: results.allResults.network.findings.map(f => ({
              question: f.question,
              result: f.result,
              points: f.result === 'PASS' ? 1 : 0
            }))
          },
          saas: {
            name: 'SaaS Apps',
            passed: results.allResults.saas.passed,
            totalPasses: results.allResults.saas.passes,
            totalQuestions: 5,
            items: results.allResults.saas.findings.map(f => ({
              question: f.question,
              result: f.result,
              points: f.result === 'PASS' ? 1 : 0
            }))
          }
        }
      };

      console.log('Sending data to webhook:', payload);

      const response = await fetch('https://watchguard.app.n8n.cloud/webhook/4896c0bf-99c5-4bda-8811-81dca8bbd3e6', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        throw new Error(`Error generating PDF: ${response.status} ${response.statusText}`);
      }

      const result = await response.json();
      console.log('Response:', result);

      if (result.pdfUrl || result.pdf_url || result.url || result.link) {
        const pdfUrl = result.pdfUrl || result.pdf_url || result.url || result.link;

        const genContainer = document.getElementById('generate-container');
        if (genContainer) genContainer.style.display = 'none';

        const downloadLink = document.getElementById('download-pdf-link');
        if (downloadLink) downloadLink.href = pdfUrl;

        const downloadContainer = document.getElementById('download-container');
        if (downloadContainer) downloadContainer.style.display = 'flex';

        if (button) {
          button.disabled = false;
          button.innerHTML = originalText;
        }
      } else {
        throw new Error('PDF not found');
      }
    } catch (error) {
      console.error('Error generating PDF:', error);
      alert(`Erro generating PDF: ${error.message}\n\nPlease, try again.`);
      if (button) {
        button.disabled = false;
        button.textContent = originalText;
      }
    }
  }

  // Initial setup
  updateProgressBar();
});