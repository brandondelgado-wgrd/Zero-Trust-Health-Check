// Wrap all logic in DOMContentLoaded to ensure elements are loaded
document.addEventListener('DOMContentLoaded', () => {

  let currentStep = 1;
  let partnerLogoData = null; // Logo para a página 1 (opcional, removido da nova capa)

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
          partnerLogoData = event.target.result; // Salva o logo, embora o novo template não o use
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
      // Validando os novos campos também
      const partnerName = document.getElementById('partnerName').value.trim();
      const yourName = document.getElementById('yourName').value.trim(); // NOVO
      const yourRole = document.getElementById('yourRole').value.trim(); // NOVO
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
    let allResults = {}; // Para PDF
    
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
      let detailedFindings = []; // Para PDF
      
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

      // Para PDF
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
   * (MODIFICADO) Coleta todos os inputs do Passo 1, incluindo os novos campos.
   */
  function collectInputs() {
    return {
      partnerName: document.getElementById('partnerName').value,
      yourName: document.getElementById('yourName').value, // NOVO
      yourRole: document.getElementById('yourRole').value, // NOVO
      partnerPhone: document.getElementById('partnerPhone').value,
      partnerEmail: document.getElementById('partnerEmail').value,
      customerName: document.getElementById('customerName').value,
      logoData: partnerLogoData
    };
  }

  /**
   * (TOTALMENTE REESCRITA) Gera o novo PDF com base no template "Zero trust health check v1".
   */
  async function generatePDF() {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();

    // 1. GATHER DATA
    const inputs = collectInputs();
    const results = getAssessmentResults();
    const brand = 'WatchGuard';
    
    // =========================================================================
    // RESPOSTAS ÀS SUAS PERGUNTAS (IMAGENS E FUNDO)
    //
    // Para imagens (logo, 'W' de fundo, ícones), a melhor forma é convertê-las 
    // para o formato Base64 e colar a string aqui.
    //
    // 1. Vá para um site como "base64-image.de"
    // 2. Faça o upload da sua imagem (ex: o logo da WatchGuard da capa)
    // 3. Copie a string `data:image/png;base64,iVBORw0KGgo...`
    // 4. Cole essa string no lugar do '...' abaixo.
    //
    // Eu adicionei placeholders para você.
    // =========================================================================
    const IMAGE_PLACEHOLDERS = {
      // Logo da WatchGuard para a capa (deve ser o logo com o 'W')
      coverLogo: 'data:image/png;base64,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', // [Fonte 59]
      // Imagem 'W' do canto (fundo da página)
      watermark: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAP4AAACzCAYAAACpUKHjAAAACXBIWXMAABYlAAAWJQFJUiTwAAAYGElEQVR4nO2d31HkONfGH0199+xLAvQWV1wNG8F4Ixi+CMYbwctEsD0RLBvBmAiWjWBFBAtXXFHVJMBHR6DvwhJjmm79s44k2+dX1TUwbcvC9qNzdHQkCaUUGIapi+fTs3MAFwAaACsAJzuH3ALYAJAAbo4fH15CyhcsfIapg+fTs58AXAJo8V7oLv4GcHX8+CB9DmbhM0xhBoK/BHA0srhbAJfHjw93toNY+AxTiMSC3+Xr8ePD1aEvWfgMkxliwQ+5Pn58aPd9wcJnmExkFPyQveJn4TMMMYUEP+Sd+Fn4DENEBYIf8r/Hjw835hcWfgBCiBX6MVWgH181DP9/Hy8AhlHWjf5AKSUTVI2piMoEb9gCWJnxfhb+HoQQDX6I2fwcOq4awhZ9w7DBj6SMO6VUUFIGU5ZKBT/kz+PHh0uAhQ8hxE/oxd0AOAfwqWR9dnhC3yBIAFIpZR2bZcowAcEP+c/x48PLIoWvLbpJh/xYtDJhbAHcQKdpskdQlokJ3vD1+PHhajHCF0JcoBf7BabzkFzcA+jQNwKbslVZFs+nZy2AK0zvXbo/fnw4n7XwtWVvMS+xH+IWPxoB9gSI0IJfgzbmQ81/Zid83Wdv0btfU344sZjuwBXHBNIxE8Ebfp2N8PVQ2xrAl4yXfYIelvPkJ+SNKdwC6JRSXcZrzoqZCd7wbfLC1+78GnTR+Fv0kfUX9EG1JGPvg5yAc/QNQgO6YcMnAGtuAPyZqeAN0xU+keDvoYfO0I+jbxKW7YXuqpzjx/Big3TxCW4AHMxc8IbpCV9byisAnxMU94Qfw2Oy1qCYEMKsxnKBNF0FbgB2WIjgDdMRvraEawD/HVmUEXs3xeCXvg+mERjb+N2ibwDk2HpNlYUJ3jAN4QshLtE/nFiXd4t+qGuSYj/EoBG4xDhP4BrAZa0eDwULFbzha9XC1y7uFeL78YuJaut7dYn4nIUteut/cNWWObBwwRvqHc4TQqwB/B55+jUWOo6tvYDYBRuBvrFs55YJyIL/wfHjg/hQuhK7CCHOhRB3iBP9NYCflVLtEkUPAEqpF6XUWim1AvAb+phGCJ8A3Onu1eR5Pj1rn0/PNgC+g0UP9KvxoirhCyFa9BH20P7qUPCbxNWaLEqpLrIBOALwhxDiRnsQk4MFf5AboJJpufrlukJ41t0s3VIKBl2A0JlkTwAupuJBsUtv5en48WEFVGDxdVBKIkz0TwB+VUo1LHo/TBcAfVLQdcCpJwD+1d5YtbCF92Jtfihq8fVU2Q5hFuibfoGZEejMxw5hIrlWSrUU9YlFbzU1ZuRnKdwfPz6cm1+KWXwdPPoL/qK/B/ALiz4NOmnnHMC3gNO+CCHuaun3P5+eXQL4Fyx6F1v0ozyvFLH4QogOYa49W3lCdHfrBv7W/x59v39DVikHz6dnHfLOxJwyvx0/PnTD/8gu/EDRTyqwNGUiAqxbAE2JZ8OiD+Kd6IGMwtcvloT/UN3f6CP2i0kjrQEdxPNdUiq7+LV7/0eu602cvaIHMgk/QvRf5546WjOBrn828etA3r/U15kB9wBa24655MIPFP0WvWsvKevEuNHP7QZ+gbMs4n8+PbvDtFZFzs0WwNXx48PadSBpVD9Q9PfoXx5JWSfGDz3u38BvzP8IgNSeAgk6MYdFv58t+tGZlY/oAWKLL4SQ8LMYRvTcn6+QgAlTZJZfJ+dwYs5btujjMVdmayxfyIQfEL1n0U8AHfT77nHoFsB5yqE+7tu/I1rwhv9JW58eIYTvsFB1mWDMfpRSnRACcIv/CMCNECJlY94mKmfqjBa8IbnwtWXwWR6LRT8xAsT/EX1sJ1Wfv0lUzlRJJnhDUldfB3d8XDIW/YQJcPuTPOfn07PyU0jLkFzwhmTC16vf3sGd+MF9+hkQIP7fxix99nx61gD4J/b8iUImeENKV/8GLPrFoN3+FdzR/u9CiDtOu/aCXPCGJMLXwTzXGKsZ6mHRzwSl1FqL3xXIvRFCnPOzP0g2wRtGC1/PqXcF81j0M0Up1Wrx2/I1TtDP/b/IUKWpcQ3gMpfgDaMy93RmXudx6GIXv1wIF3Cv6fd5Lgt4JuIawM/Hjw9tbtED41N2O7j79d+UUjcjr8NUjPbkLtB7djZM1yCEuRmMoeA3pSoRHdXXLv5fjsNudb43swA8I/3B78RM0nWvAaxLin1IlPC1i7+B3dpvAayW1K8fbH3tg9kVF+i34HZatilMYPJM1Q6adj3xhTeqErwhVvg3cG/Y+GvKF1UvDrmPoYBeKbFUl94IhHIGWdJ76oNOvfW+pjYKd7Bb6CCjoGfm+eQM1ESVgjcEC18L0JVQ8adSyhrI0eU0+tdm5+sUiyf+nHNNuICsxTFkz3jUMyw3Idf1vBdBf8vz6dkL4jdNzUnVgjfEBPc6x/dPGKzfbaFBn/zxO3qhDz8pWCUqx5ccEesvhVa4/RKyrr4ewXGt3vvF4sXto/YVmaoI2vkSJHw9HOMKsviukydDrh1BNoEMtqvOQZvpOgbTjfoestCG7mq5hvhCxHwF96hBCSYleIO38PXLvXYcdl1RAIpsNZg9XCCfG5p7LHz4d8lAj6N1fP/R15PQY93rgGtTM0nBG0IsvmvPtS3CXspNwLEx5HSJc4rxJNBFjmaPhT+C3nTRB20EXEt3rX3LO358uILe7bUgkxa8wUv4gw0XbaxDhu4yBN6yWHwtjtxrwbWZrrOv8fwUmIF3CbuLfhK4L1+LfrJXbmYheIOvxXdZ+6fI5bBD924PIZfFL5GGepEpyHeo8fzDt7+vjYHr3Vj7Vki7/A3yiX9Wgjc4he9p7WNf/k3keT7kssIlJp4cZbqurXEJDczZGvkgqz8Q/21AHUKZpeANPhbfZe1vR+TibyLP84LaKuq05VJjy22Ga9isurfLr63+2nGY6/s3HD8+vBw/PjQAviJttH/WgjdYhe/btx9x/c2Ic32g7ue3xOXb+BQx4SUUV8O59m1c9So8yay+QQf8zuG3/r+NRQje4LL4Lot2O3L4bjPiXB9WVAXrF96VtkwNtbvvSqY6QpjLv3Z8H9VlPH582Bw/PrQAfkbvAfj2/+8B/IkFCd5gTdkVQmxgT9gZlTvumf47BrLttQPWnKPkSSm1oihYN2z/53n4L77rLXi8U95l2Xg+PTNzOM7x1nMxE6LuSsyDrwal1N4P+uCJsnw2h871/aB/ILZrjP3cjK2jpe53xHX3/ZwT/X2u5z/8yIByLx1ldVTPjD8/PjZXv7V8ByTIolL0U3ZJgnu6b13LPm4tUbmrgGM/BSQVdbAH40rNR1gUe4Wvb7xt/vNWjVgyeQfKIZlUE352KTGEdwiquqwCj1/7HKQbe9coUE33d5YcsviuG98lrAOp1SeyHi1BmbGcEO1SG1pmiNVfO74vkRS1KGKFn3KK5OhAjoOkoqjMzTe0BGXGNJi+4/ob2CPvHzMMVS6ad8L3GKa6V2nz7CclfNTphlLUKaab9DlAsC7jUeN9ng37LH5ONx+Y3iy9NnF5KUjq7o+0tr5uuquf346oA+OguPAV/Xr7TaqCKnXzDW3CslYjzm19DtJBPtsUW3b3CdknfJubf0s0BEc5S2+VsKwmYVmpaRKWNcZ7OApIvXVZ/WZEPRgLb4SvJ53YiJ2M44LS6qdcj73mfmdKCzm2HN/7xMN6hdi1+I3j+CkKf99KMjFl1JCb7yKVUMber88+w6jae7TlcTQj68EcIET4T4mj+UOo+/mrBGU0CcrYJfUyUrUIH0hj9Y+IchQWz6vwdQttC1xRWXtgGtNzU7udt0h/Tz+NTVjS56dYY8D3fknH9824ajD7GFr8xnGspKpEhsh+CuE3CcoYIkHTmDYjz09lYb26RfrZ23L3myS1Yd4wFL7rgUvCegC0OfurMSdrdzP1po1S93FTrx031jNJmQ+Qwuqzq0+Ar8W/zzCTbkNY9tix9yZFJYaoH+sYSMthMTQjz18lqIOh8TzO5vGd8Hh+enwtPrUrTn6NkUEiiv69QSYue2wWX0oL23geJx3fr0bVgnnHB8AroDN54SPyhdb3JvX0Xnng51Q0I85NKXwvT0u5V3FqRteEeYOx+K6HTS58j4c/llXkeU3COhik+aGmfn7CiP6wzMbzUFv2JvfzE1ON8DWUmyQ0mc87xHZPI7f7+1hiPZSS8/pt7xivyJMYI3zbjd1mCOwZKBuYVeR5TcI6APtFvu//RhG5v17MOS5SCJ9qJaXFYoTfWI7JZe2prxU8HOeR1BSD3P0PFb8hiY0m4pxV4jqElLkhuDZzAJ+ddDbUlRhAHdlvAk+hmCQiD/x/6jyGJuKcVeI6AP7WemP7MtcOwUvBCN/2cDYZ6gEgS4AvtA/bJL7+1pKlKBNfK8Y9LulSbwpee3H4WPzcmw5QBvhWgcc3ia8vI7+LIsRKUk6G8amHxwQwjuwn5IPHpI6cfXyANjXY++XR9yV5mu6hL4i8nSbg2NqFxZH9hHxAfQ+csqEJcWUbgutLx/cl+/mrxNce4vuOUc7XYAbU6OpLysIDXNom8aVt/XuDTHzN0g2dIYW1ZoufEKfwM0yZ3b3eBmn3O9+llPBlomOCCOjnU3p+mwRl1OaZThofi18CSVj2yvM48vH7XYj6+U7B6NlvSVN1d5CEZTMRLFH4jesAojFj6XlciX4+pTUNWbItd7dysdQqfMruhc9L3iS+pk//3iATX9vn76UUfsizzD2CtFiqFD5xIs+Rx8IOqYUgiY71wWchiybxNYdIwrKZSKoUvoZyaMcl7GLCL9TPp7T4MuBYjtxnombhS8KyD77o2jpmS9w5QOpGz/X3UgX2Qro4AEfus7FU4TeW71K/fKEvP5B3Hb5arD2TEafwx67THgtxP9+W2JJaCDEBq9RBLtvfxMJfID4Wv6T7RdbPt2TwNYkvJTOdY8MW0GwSX2uIrLSsxfMBdY+dUu7ec0j4JSP6AMjW4cv19xqeIro4HNzLxIfcKbmBSMKym93/oAh0jeiyxJ53iHcC114PVWBPRpyTOluSOYCPq99QV+IQHtsrjWGfpVslvsaYropMVQlNs+f/ptS/3yQub9EY4duWNi6NJCr3457AZZP4GnLEuTkCfE3iawyRIQd7zJrcRNeEeYcR/sZyTOmx1Zz9/Boi+gBeZymmbJCPMjR0hvuILdVd/fuaY1GTwwjfdlNLB1wkYdnNzu+rxOXLwufv8tqwEa0wZJAR51gb3cpjUZPDCL/aNc215aBah6/Z+T1lcCnFRqMyRUUGNAd+Tk2Ml7ayfEe5PsMi8XH14THJgxpJVO5ro0aw2GQKC5Xayq0GPzeJyzbs2ynIB9v9Z2ufGC/ho/xupWT9/MHc+1XiouXYAghGNVaDn5uE5Q6Rkeex8DPyAah/t1JdPyp3r9H/Fk/cOUDKl/4TQLZDkCG4kfbIn9hE1oU5wHAc39aPLh3ZB+jcfbNbTsq/cRsR1T6ETFQOgFeRUewQZJAR59SyaetiGArfdnMb4nr4QOXum/H8VcIyZaVlAf3f2SQu0xAzjAe4I/oyqjbMQXyF77NqDTWU4/kXSOv6JrNQBC/9Oegsfhd5XmP5jnJnpcXiK3ygfD//BXSz9S4TlycTl5fy5W9RV34+YB8yZjefgFfhe1gWyn6hL2TufsrCCKx0yvKognoxs/EghHC9VzKuOoyN3Uk6NovaENbDF0p3PxUUrukUrF7ss2kc38vIchkLu8K3Pbwjyh1VfSDO4kuFJChzCsLvIs+zWfyQNfmZAHaFLx3HtzTVCKIrXQEHyUVKPD05BbFu/gr2+QJT8PAmyRvh64dnmxE2535+Kqisc81WP/aZcP++EPsW4pCW40/Y3bcSs6KuL5Ko3BR0kee1ti+VUrU38pNln/BdN7slqEcoXekKHIDSKtdq8ce4+bYRhr9jK8S4eSd83cra+pPs7h9GEpZdq/Bjn4Urd6LWZzwLDq25Z7vpJx5jr6Rod59yi61YyMRJsCJPKrrI82zv0BYsfFJihA+wu38Iaqtcm9W/H5G0Y43mJ1jEhLGwV/ja3bdZl88zz92PIeWMvEPUJvwu8jx28wtjW167c5zbpqtGONoiXJesww45RCkzXCOE2Ln3ttz8J47m0zNG+Jel9tUbUNMLIjNcoyaL/3ekh7N2fN9FlMkEclD4+qHahlSOkH5WWxAeXZKckItSezm1/L2x1v6L47Auoi5MIK6ddK4c37eJ6jGGWqx+Lmu8yXQdG1ulVBdxXuv4/ppz8/NgFb6eXmrLkjsRQhS1+nA3TjnIEdgzyEzXsdGFnqC7ha53pYZnuQh89s5zPYx1yb5+JWP6OfveNfTzu4hz1rAvAHLLm2bkwyl87dLZ+pXF+/oo3y9ckvCDBar79v91HLaOrA8TgY/FB9wPpWiEXzdOJaetZhNjBX3gLuIcl9d4ywtq5sVL+J5Wv3T/rOT1N5mvV6prExzU0xuWfHYcto6sDxOJr8UH3A/ny2BXmhJ0pS5cwFqVcve7iHPY2leIt/B1S++yNMWsrkfeARUl1gbYFLgmEPh8hRBruBf3LB0fWiQhFh9wW/2P+mGXokTDsylwzRIWPyhTTwf0XKK+5kh+GYKEr10yl1X9vdQqPR55BxRkf3ELucahjWoH+/DdFmztixFq8YH+Ybki6F1EuanIbfVLWaycqbv3IY2NTuqyTcQBgDVPvS1HsPC1u7d2HFbM5fcYgUjNJuO1Sl3XuzHV3t7acdi9Uqr0KNCiEUqpuBOFuIM7cPNr6Yitzi9wdT18jtnlHMBPSqkmpl5jEUK06HPfZeCpL3B7KS+RC2z8pOvjei9+4b59WcYI/xzAv47DtgBW7NItAyFEB/fsu29KqTV9bRgbMX18AK9r8H9zHHaEOiaVMMRoD8Ql+nsWfR1EW/zXAoSQcAdyrpVS7agLMdXi6f0B7OJXQ7TFH9DCHeX/oi0CMzP0eL30OPQri74eRgtfR/lbj0O/l16Wm0mLDubdwD5eD/TJPxzFr4jRrv5rQUJcwT31cgug4ZZ/+gRE8J8AnHOAty5SuPoAAKXUJdy5/EcAZOn995gkXMEt+i2ACxZ9fSQTvuYC7uQZFv/E8Ry2A4BL9u7qJKnwdct+AXewj8U/UQJE/y1yQU4mA8n6+G8K7efl/+NxKPf5J0SA6Hn4tnJIhA+8JnR89ziUxV85g+i9K18D6CP4PHpTOan7+K9oN+83j0ON288vS4UMovc+or9HHXstMA7IhA8Ei/8vTvKpCx2DkXBH74Fe9A1H8KcBmav/5iL+bj/A/cMq0HEan+QcgEU/OUgtviHA8gN9eu9dBRtyLha9lsI/YNHPliwW//ViYZbfJH9Isgoxb9CNbQf3ctgGFv1EyWLxDYGW/wjAP4UX71wM2rW/g7/or8GinyxZLf7rRcP6j4COFvOQHw2e8yyGcBxm4mS1+AbtvjfwXxvvI4B/2fqnRQjR6CXUQkT/G4t++hSx+K8XD0sMMdyjzwGXJJVaAPq+rxEmeI65zIgiFt+glHrRi1X+GXDaR/R9/44j/+HoAOsGYaK/Rz+1VhJUiSlAUYs/RGfudfDv9wO9FboCcMVBJjs6ruIzlXaXa/QeFt/fGVGN8IHXZZw6hLn+gN6VhWeDvUcLfo24e9oqpW5S14kpT1FXfxel1Ea7/q7Ve3c5Qr+010YIccldgNfAnUSfiBMq+lv0rj2LfqZUZfGH6DzxDuGuKfCjC9CFbPQ4B3Qf/hLx923N6+PNn2qFb9D7sK0R1vcf8jf6BmC21muwM22LcffpcmkN5VKpXvjA64t9Bf+ssn08oR867OaQCKS7MxfoxR7qyg95Qi/42TaMzHsmIXzDiMj0LpNsBHQD2KAX/JhGENDdId7ZZplMSvgG3Y9dAzhJUNwWfSMgAciaXF1t1ZvBZ2yDZ/gTvE31opmk8A2JGwDDE/rJKnfoG4O7XALRHs0KvcjPkU7ohmv0gt8kLpeZGJMWvoGoAdjlFj+2mB5uNe21pbR201f6V/Oz2Z57Bbq6L3aEgznMLIRv0BbzEuP7v3PgCT8Ezy4984ZZCd+grWurP5ReQI1cA7jhKD1jY5bCH6LnAJhP7Bh37dyjt+43bN0ZH2Yv/CEzawRu0Y9G3HDfnQllUcIfolOCL9BH0MckwOTC5B5I9MOObNmZaBYr/F10YLBBH2U/R9nYwBaD4USw0JnEsPAtDMbVV+gbAzP8lqqbcI+3Q4QSwIZdd4YaFv4IdMOwi2kggF7Iu7CwmeL8PzIYt2D/mrBCAAAAAElFTkSuQmCC', // [Fonte 72, 83-87, etc.]
      // Ícones do gráfico (ex: [Fonte 92]) - Opcional, pois você manteve seu gráfico
      graphIcon1: 'data:image/png;base64,...',
      graphIcon2: 'data:image/png;base64,...'
    };
    
    // --- Constantes de Layout ---
    const pageWidth = 210;
    const pageHeight = 297;
    const margin = 20;
    const contentWidth = pageWidth - (2 * margin);
    let y = margin;
    
    // Cor vermelha da WatchGuard
    const wgRed = [232, 20, 16];
    // Cor azul escuro da WatchGuard
    const wgDarkBlue = [0, 38, 99];

    // --- Funções Auxiliares ---
    
    /**
     * (NOVO) Helper para desenhar o fundo ('W') em cada página.
     * Isto responde à sua pergunta sobre o fundo.
     */
    function drawPageBackground(doc) {
      const watermarkString = IMAGE_PLACEHOLDERS.watermark;
      if (watermarkString.length < 50) return; // Não desenha se for placeholder

      try {
        // Exemplo: Adiciona 'W' no canto superior esquerdo e inferior direito
        doc.addImage(watermarkString, 'PNG', 5, 5, 15, 15);
        doc.addImage(watermarkString, 'PNG', pageWidth - 20, pageHeight - 20, 15, 15);
      } catch (e) {
        console.error("Erro ao adicionar 'W' de fundo. Verifique o Base64.", e);
      }
    }

    /**
     * (NOVO) Helper para desenhar a tabela de resultados de um domínio.
     */
    function drawDomainFindingsTable(doc, domain, yPos) {
      let y = yPos;
      
      // Cabeçalho da Tabela
      doc.setFillColor(wgRed[0], wgRed[1], wgRed[2]);
      doc.rect(margin, y, contentWidth, 10, 'F');
      doc.setFontSize(9);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(255);
      doc.text('AUDIT CHECK', margin + 2, y + 7); // [Fonte 120]
      doc.text('ZERO TRUST PASS/FAIL', margin + contentWidth - 45, y + 7); // [Fonte 121]
      y += 10;
      doc.setTextColor(0);

      // Linhas da Tabela
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      
      domain.findings.forEach((item, idx) => {
        const rowHeight = 12; // Aumentar para texto que quebra
        const textLines = doc.splitTextToSize(item.question, contentWidth - 55);
        const actualRowHeight = Math.max(rowHeight, textLines.length * 4 + 4);

        if (y + actualRowHeight > pageHeight - margin) {
          doc.addPage();
          drawPageBackground(doc);
          y = margin;
        }
        
        // Fundo da linha
        const rowColor = idx % 2 === 0 ? 255 : 245;
        doc.setFillColor(rowColor, rowColor, rowColor);
        doc.rect(margin, y, contentWidth, actualRowHeight, 'F');
        doc.setDrawColor(200);
        doc.rect(margin, y, contentWidth, actualRowHeight, 'S'); // Linha da borda

        // Texto da Pergunta
        doc.text(textLines, margin + 2, y + (actualRowHeight / 2) - (textLines.length * 4 / 2) + 2);
        
        // Resultado (PASS/FAIL)
        const isPass = item.result === 'PASS';
        const resultColor = isPass ? [42, 143, 72] : [220, 53, 69];
        doc.setTextColor(...resultColor);
        doc.setFont('helvetica', 'bold');
        doc.text(item.result, margin + contentWidth - 45, y + (actualRowHeight / 2) + 2);
        
        doc.setTextColor(0);
        doc.setFont('helvetica', 'normal');
        
        y += actualRowHeight;
      });
      return y;
    }

    /**
     * (MANTIDO) Função do seu script original para desenhar o gráfico.
     */
    function drawJourneyGraph(startY, passedDomains) {
      const graphHeight = 60;
      const graphWidth = contentWidth - 10;
      const originX = margin + 10;
      const originY = startY + graphHeight;

      doc.setLineDashPattern([1, 1], 0);
      doc.setLineWidth(0.5);
      doc.setDrawColor(150);
      doc.line(originX, originY, originX, startY); 
      doc.line(originX, originY, originX + graphWidth, originY);
      doc.setLineDashPattern([], 0);

      doc.setFontSize(8);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(100);
      const yAxisX = originX - 3;
      const yAxisBottom = originY - 5;
      doc.text("Visibility      Control      Automation", yAxisX, yAxisBottom, { 
        angle: 90 
      });

      doc.setFontSize(10);
      doc.setFont('helvetica', 'bold');
      doc.text("1", originX + (graphWidth * 0.25), originY + 5, { align: 'center' });
      doc.text("2", originX + (graphWidth * 0.5), originY + 5, { align: 'center' });
      doc.text("3", originX + (graphWidth * 0.75), originY + 5, { align: 'center' });

      doc.setFontSize(9);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(100);
      doc.text("Domains Protected", originX + (graphWidth / 2), originY + 12, { align: 'center' });
      doc.setTextColor(0);
      
      const endX = originX + graphWidth - 10;
      const endY = startY + 5;
      doc.setLineDashPattern([1, 1], 0);
      doc.setDrawColor(wgRed[0], wgRed[1], wgRed[2]);
      doc.line(originX, originY, endX, endY);
      doc.setLineDashPattern([], 0);

      doc.setFontSize(12);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(wgDarkBlue[0], wgDarkBlue[1], wgDarkBlue[2]);
      doc.text("Zero Trust", endX, endY - 5, { align: 'center' });

      const totalDomains = 3;
      const markerX = originX + (graphWidth * (passedDomains * 0.25));
      const progressAlongLine = (markerX - originX) / (endX - originX);
      const markerY = originY + ((endY - originY) * progressAlongLine);

      doc.setFillColor(wgRed[0], wgRed[1], wgRed[2]);
      doc.circle(markerX, markerY, 4, 'F');
      
      doc.setFontSize(9);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(0);
      doc.text("You Are Here", markerX, markerY + 8, { align: 'center' });
      doc.setFont('helvetica', 'normal');
      doc.text(`(${passedDomains} of ${totalDomains} Domains Protected)`, markerX, markerY + 12, { align: 'center' });

      return originY + 15;
    }


    // =========================================================================
    // INÍCIO DA GERAÇÃO DO PDF (Página por Página)
    // =========================================================================

    // --- PÁGINA 1: Capa ---
    drawPageBackground(doc);
    
    // Adicionar Logo da Capa (se o placeholder foi preenchido)
    if (IMAGE_PLACEHOLDERS.coverLogo.length > 50) {
      try {
        doc.addImage(IMAGE_PLACEHOLDERS.coverLogo, 'PNG', (pageWidth / 2) - 25, 40, 50, 50);
      } catch (e) { console.error("Erro ao adicionar logo da capa.", e); }
    }
    
    y = 100;
    doc.setFontSize(32);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(wgRed[0], wgRed[1], wgRed[2]);
    doc.text('Zero Trust', pageWidth / 2, y, { align: 'center' });
    y += 12;
    doc.text('Health Check', pageWidth / 2, y, { align: 'center' });
    y += 20;
    
    doc.setFontSize(16);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(0);
    doc.text('Powerful Protection That\'s Reality-Ready', pageWidth / 2, y, { align: 'center' });
    y += 40;
    
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text('Presented By:', margin, y);
    y += 8;
    
    doc.setFontSize(11);
    doc.setFont('helvetica', 'normal');
    // (REQ 1) Usando os novos campos do formulário
    doc.text(inputs.yourName || 'Your Name', margin, y); // [Fonte 68]
    y += 6;
    doc.text(inputs.partnerName || 'Your Company Name', margin, y); // (Nome da empresa)
    y += 6;
    doc.text(`Phone: ${inputs.partnerPhone || 'Your Phone'}`, margin, y); // [Fonte 69]
    y += 6;
    doc.text(`Email: ${inputs.partnerEmail || 'Your Email'}`, margin, y); // [Fonte 70]
    
    doc.addPage();

    // --- PÁGINA 2: Executive Summary ---
    drawPageBackground(doc);
    y = margin;
    
    doc.setFontSize(18);
    doc.setFont('helvetica', 'bold');
    doc.text('Executive Summary:', margin, y); // [Fonte 73]
    y += 10;
    
    doc.setFontSize(12);
    doc.setFont('helvetica', 'normal');
    doc.text(`Dear ${inputs.customerName || 'Customer'},`, margin, y); // [Fonte 74]
    y += 8;
    
    const summaryText1 = "We've partnered with WatchGuard Technologies to provide a Zero Trust Health Check for our customers."; // [Fonte 75]
    const summaryText2 = "The goal is to outline the security protection or lack thereof in place between potential hackers and your applications."; // [Fonte 76]
    const summaryText3 = "This best practice, as defined by Zero Trust, is to verify the security of identities, devices, and networks that can access applications you may have in the cloud, on-premises, and even locally on your devices."; // [Fonte 77]
    const summaryText4 = "Ultimately, achieving Zero Trust will help position our team to find and stop attacks against these applications at scale to protect your data and operations."; // [Fonte 78]
    const summaryText5 = "We've prepared this short report to outline your status and are available to answer any questions you may have about the findings."; // [Fonte 79]
    
    let textLines = doc.splitTextToSize(summaryText1, contentWidth);
    doc.text(textLines, margin, y);
    y += (textLines.length * 5) + 4;
    
    textLines = doc.splitTextToSize(summaryText2, contentWidth);
    doc.text(textLines, margin, y);
    y += (textLines.length * 5) + 4;
    
    textLines = doc.splitTextToSize(summaryText3, contentWidth);
    doc.text(textLines, margin, y);
    y += (textLines.length * 5) + 4;
    
    textLines = doc.splitTextToSize(summaryText4, contentWidth);
    doc.text(textLines, margin, y);
    y += (textLines.length * 5) + 4;
    
    textLines = doc.splitTextToSize(summaryText5, contentWidth);
    doc.text(textLines, margin, y);
    y += (textLines.length * 5) + 15;

    doc.text('Sincerely,', margin, y); // [Fonte 80]
    y += 8;
    
    // (REQ 2) Usando os novos campos do formulário
    doc.setFont('helvetica', 'bold');
    doc.text(inputs.yourName || 'Your Name', margin, y); // [Fonte 81]
    y += 6;
    doc.setFont('helvetica', 'normal');
    doc.text(inputs.yourRole || 'Your Role', margin, y); // [Fonte 82]

    doc.addPage();
    
    // --- PÁGINA 3: O Gráfico ---
    drawPageBackground(doc);
    y = margin;
    
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(wgRed[0], wgRed[1], wgRed[2]);
    doc.text(`> ${results.passedDomains} of 3 Domains Protected`, margin, y); // [Fonte 88]
    y += 8;
    
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(0);
    const graphIntro = "Achieving Zero Trust means that every domain with an application permits access based on continuous validation of the identity, device and network connected to it. The following graphic outlines where you are in this journey."; // [Fonte 89, 90]
    textLines = doc.splitTextToSize(graphIntro, contentWidth);
    doc.text(textLines, margin, y);
    y += (textLines.length * 5) + 10;
    
    // (REQ 3) Mantendo seu gráfico original
    y = drawJourneyGraph(y, results.passedDomains);
    
    doc.addPage();

    // --- PÁGINA 4: Endpoint Apps ---
    drawPageBackground(doc);
    y = margin;
    
    doc.setFontSize(18);
    doc.setFont('helvetica', 'bold');
    doc.text('☑ Endpoint Apps', margin, y); // [Fonte 109]
    y += 10;
    
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  const endpointIntroText = "In this domain, applications are installed locally on a laptop, server, workstation, or mobile device. Protecting these applications involves security software installed locally on the devices.";
  let endpointLines = doc.splitTextToSize(endpointIntroText, contentWidth);
  doc.text(endpointLines, margin, y); // [Fonte 110-111]
  y += (endpointLines.length * 5) + 2;
    doc.text("The Zero Trust Health Check examines key aspects such as:", margin, y); // [Fonte 112]
    y += 6;
    doc.setFont('helvetica', 'bold');
    doc.text("• Coverage:", margin, y);
    doc.setFont('helvetica', 'normal');
    doc.text("Are all devices that run software currently running your security software?", margin + 18, y); // [Fonte 113]
    y += 6;
    doc.setFont('helvetica', 'bold');
    doc.text("• Hardening:", margin, y);
    doc.setFont('helvetica', 'normal');
    doc.text("Are all the applications that are capable of running on the Endpoints trusted?", margin + 20, y); // [Fonte 114]
    y += 6;
    doc.setFont('helvetica', 'bold');
    doc.text("• Authenticated:", margin, y);
    doc.setFont('helvetica', 'normal');
    doc.text("Are the people who use the devices verified by strong multi-factor authentication...?", margin + 27, y); // [Fonte 115]
    y += 6;
    doc.setFont('helvetica', 'bold');
    doc.text("• Threat Detection:", margin, y);
    doc.setFont('helvetica', 'normal');
    doc.text("Are local threats... like Ransomware, something that is detected when run?", margin + 31, y); // [Fonte 116]
    y += 6;
    doc.setFont('helvetica', 'bold');
    doc.text("• Threat Response:", margin, y);
    doc.setFont('helvetica', 'normal');
    doc.text("Do local threats... once detected, remove access to the device?", margin + 32, y); // [Fonte 117]
    y += 10;
    
    drawDomainFindingsTable(doc, results.allResults.endpoint, y);
    
    doc.addPage();

    // --- PÁGINA 5: Network Apps ---
    drawPageBackground(doc);
    y = margin;
    
    doc.setFontSize(18);
    doc.setFont('helvetica', 'bold');
    doc.text('Networked Apps', margin, y); // [Fonte 137]
    y += 10;
    
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  const networkIntroText = "In this domain, applications are inside company-run data centers, such as a cloud provider, office facility, or colocation provider. In this scenario, we require network visibility around the device.";
  let networkLines = doc.splitTextToSize(networkIntroText, contentWidth);
  doc.text(networkLines, margin, y); // [Fonte 138-139]
  y += (networkLines.length * 5) + 2;
    doc.text("The Zero Trust Health Check examines key aspects such as:", margin, y); // [Fonte 140]
    y += 6;
    // ... (Textos de [Fonte 141-145] - Adicionando de forma resumida)
    doc.text("• Coverage: Are there network filters between your hosted networked apps and the endpoints...?", margin, y); y += 6;
    doc.text("• Hardening: Are there policies to group which devices are permitted to access networked apps...?", margin, y); y += 6;
    doc.text("• Authenticated: Are there policies to group which users are permitted to access networked apps...?", margin, y); y += 6;
    doc.text("• Threat Detection: Are network threats... like MITRE techniques, detected when run?", margin, y); y += 6;
    doc.text("• Threat Response: Do network threats... once detected, remove access to the device?", margin, y); y += 10;

    drawDomainFindingsTable(doc, results.allResults.network, y);

    doc.addPage();

    // --- PÁGINA 6: SaaS Apps ---
    drawPageBackground(doc);
    y = margin;
    
    doc.setFontSize(18);
    doc.setFont('helvetica', 'bold');
    doc.text('SaaS Apps', margin, y); // [Fonte 152]
    y += 10;
    
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  const saasIntroText = "In this domain, applications are managed by a 3rd party Software as a Service provider such as Microsoft 365... In this scenario we require visibility into the network, endpoint and identities...";
  let saasLines = doc.splitTextToSize(saasIntroText, contentWidth);
  doc.text(saasLines, margin, y); // [Fonte 154-155]
  y += (saasLines.length * 5) + 2;
    doc.text("The Zero Trust Health Check examines key aspects such as:", margin, y); // [Fonte 156]
    y += 6;
    // ... (Textos de [Fonte 157-161] - Adicionando de forma resumida)
    doc.text("• Coverage: Are all cloud applications in use by devices... monitored regardless of location?", margin, y); y += 6;
    doc.text("• Hardening: Are there policies only allowing trusted SaaS applications?", margin, y); y += 6;
    doc.text("• Authenticated: Are users verified by strong multi-factor authentication...?", margin, y); y += 6;
    doc.text("• Threat Detection: Are threats... like Account Takeovers, detected?", margin, y); y += 6;
    doc.text("• Threat Response: When threats are detected, is access removed?", margin, y); y += 10;
    
    drawDomainFindingsTable(doc, results.allResults.saas, y);

    doc.addPage();
    
    // --- PÁGINA 7: Copyright/Contato ---
    drawPageBackground(doc);
    y = pageHeight / 2 - 40; // Centralizar verticalmente

    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text('NORTH AMERICA SALES 1.800.734.9905', pageWidth / 2, y, { align: 'center' }); // [Fonte 195]
    y += 6;
    doc.text('INTERNATIONAL SALES 1.206.613.0895', pageWidth / 2, y, { align: 'center' }); // [Fonte 196]
    y += 6;
    doc.text('WEB www.watchguard.com', pageWidth / 2, y, { align: 'center' }); // [Fonte 198]
    y += 20;

    doc.setFontSize(8);
    doc.setFont('helvetica', 'italic');
    const disclaimer = "No express or implied warranties are provided for herein. All specifications are subject to change and expected future products, features or functionality will be provided on an if and when available basis."; // [Fonte 199]
    doc.text(disclaimer, pageWidth / 2, y, { 
    align: 'center', 
    maxWidth: contentWidth - 20 
    });
    y += 12;

    const copyright = "©2025 WatchGuard Technologies, Inc. All rights reserved. WatchGuard, the WatchGuard logo, Firebox, ThreatSync, Unified Security Platform, and AuthPoint are registered trademarks of WatchGuard Technologies, Inc. in the United States and/or other countries. All other tradenames are the property of their respective owners."; // [Fonte 200-201]
    doc.text(copyright, pageWidth / 2, y, { 
    align: 'center', 
    maxWidth: contentWidth - 20 
    });


    // --- (REMOVIDO) Loop de Rodapé Antigo ---
    // O novo template não tem rodapé em todas as páginas, 
    // então o loop `for(let i = 1; i <= pageCount; i++)` foi removido.
    // O fundo ('W') é adicionado com `drawPageBackground(doc)` no início de cada página.

    // Save PDF
  const safeName = (inputs.customerName || 'Report').replace(/\s+/g, '_');
    doc.save(`${brand}_ZT_HealthCheck_${safeName}.pdf`);
  }

  // Initial setup
  updateProgressBar();
});