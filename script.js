// Wrap all logic in DOMContentLoaded to ensure elements are loaded
document.addEventListener('DOMContentLoaded', () => {

  // --- CÓDIGO DE TESTE PARA PREENCHER "PASS" ---
  // Encontra todos os seletores com a classe "assessment-field" e define o valor como "PASS"
  document.querySelectorAll('.assessment-field').forEach(selectElement => {
    selectElement.value = 'PASS';
  });
  // --- FIM DO CÓDIGO DE TESTE ---

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
   * FUNÇÃO MODIFICADA
   * Adiciona lógica para resetar os botões do Passo 5 se o usuário voltar.
   */
  function prevStep() {
    if (currentStep > 1) {
      currentStep--;
      showStep(currentStep);

      // --- INÍCIO DA MODIFICAÇÃO ---
      // Se saímos do passo 5, reseta os botões
      if (currentStep < 5) {
        const genContainer = document.getElementById('generate-container');
        const dlContainer = document.getElementById('download-container');
        
        if (genContainer && dlContainer) {
          // Mostra o botão de gerar
          genContainer.style.display = 'flex';
          // Esconde o de download
          dlContainer.style.display = 'none';
          // Limpa o link antigo
          document.getElementById('download-pdf-link').href = '#'; 
        }
      }
      // --- FIM DA MODIFICAÇÃO ---
    }
  }

  function showStep(step) {
    document.querySelectorAll('.step').forEach(s => s.classList.remove('active'));
    document.querySelector(`.step[data-step="${step}"]`).classList.add('active');
    updateProgressBar();
    window.scrollTo(0, 0);
  }

  // Esta função calcula os resultados para a UI (Passo 5)
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
   * Função mestre para coletar todos os dados da avaliação.
   */
  function getAssessmentResults() {
    const domains = ['endpoint', 'network', 'saas'];
    const domainNames = ['Endpoint Apps', 'Network Apps', 'SaaS Apps'];
    let passedDomains = 0;
    let domainResults = []; // Para UI
    let allResults = {}; // Para enviar ao webhook
    
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
      
      const isPassed = passes >= 4; // Precisa de 4 de 5 para passar
      if (isPassed) passedDomains++;
      
      // Para UI
      domainResults.push({
        name: domainNames[index],
        passed: isPassed,
        score: `${passes}/5`
      });

      // Para webhook
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
   * Coleta todos os inputs do Passo 1
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
   * FUNÇÃO MODIFICADA
   * Envia todos os dados para o webhook e controla a exibição dos novos contêineres de botão.
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

      // Preparar o payload com todos os dados (unchanged)
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

      console.log('Enviando dados para o webhook:', payload);

      const response = await fetch('https://watchguard.app.n8n.cloud/webhook-test/4896c0bf-99c5-4bda-8811-81dca8bbd3e6', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        throw new Error(`Erro ao gerar PDF: ${response.status} ${response.statusText}`);
      }

      const result = await response.json();
      console.log('Resposta do webhook:', result);

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
        throw new Error('Link do PDF não encontrado na resposta do servidor');
      }
    } catch (error) {
      console.error('Erro ao gerar PDF:', error);
      alert(`Erro ao gerar PDF: ${error.message}\n\nPor favor, tente novamente.`);
      if (button) {
        button.disabled = false;
        button.textContent = originalText;
      }
    }
  }

  // Initial setup
  updateProgressBar();
});