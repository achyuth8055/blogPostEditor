class SEOTools {
  constructor() {
    this.seoData = {
      title: "",
      content: "",
      metaDescription: "",
      focusKeyword: "",
      slug: "",
    };
    this.analysisResult = null;
    this.isAnalyzing = false;
  }

  init() {
    console.log("Initializing SEO Tools...");
    try {
      const sidebarSEO = document.getElementById("seo-focus-keyword-sidebar");
      if (!sidebarSEO) {
        this.createSEOPanel();
      }

      this.bindEvents();
      console.log("✅ SEO Tools initialized successfully");
    } catch (error) {
      console.error("❌ SEO Tools initialization failed:", error);
    }
  }

  createSEOPanel() {
    const existingPanel = document.getElementById("seo-panel");
    if (existingPanel) {
      console.log("SEO panel already exists");
      return;
    }

    console.log("Creating SEO panel...");
    const seoPanel = document.createElement("div");
    seoPanel.id = "seo-panel";
    seoPanel.className = "seo-panel";
    seoPanel.innerHTML = `
            <div class="seo-panel-header">
                <h3><span class="material-symbols-outlined">search</span> SEO Analysis</h3>
                <button type="button" id="toggle-seo-panel" class="seo-toggle-btn">
                    <span class="material-symbols-outlined">expand_less</span>
                </button>
            </div>
            
            <div class="seo-panel-content">
                <!-- SEO Fields -->
                <div class="seo-fields">
                    <div class="seo-field">
                        <label for="seo-focus-keyword">Focus Keyword</label>
                        <input type="text" id="seo-focus-keyword" placeholder="Enter your target keyword">
                    </div>
                    
                    <div class="seo-field">
                        <label for="seo-meta-description">Meta Description</label>
                        <textarea id="seo-meta-description" placeholder="Brief description for search engines (150-160 chars)" maxlength="200"></textarea>
                        <small class="char-count">0/160 characters</small>
                    </div>
                    
                    <div class="seo-field">
                        <label for="seo-slug">URL Slug</label>
                        <input type="text" id="seo-slug" placeholder="url-friendly-slug">
                        <small>Generated automatically from title</small>
                    </div>
                    
                    <button type="button" id="analyze-seo-btn" class="seo-analyze-btn">
                        <span class="material-symbols-outlined">analytics</span>
                        Analyze SEO
                    </button>
                </div>

                <!-- SEO Score Display -->
                <div class="seo-score-container" id="seo-score-container" style="display: none;">
                    <div class="seo-score-header">
                        <div class="seo-score-circle">
                            <div class="score-inner">
                                <span class="score-number" id="seo-score-number">0</span>
                                <span class="score-label">/100</span>
                            </div>
                        </div>
                        <div class="seo-score-text">
                            <h4 id="seo-score-title">SEO Score</h4>
                            <p id="seo-score-status">Not analyzed yet</p>
                        </div>
                    </div>
                    
                    <div class="seo-categories" id="seo-categories">
                        <!-- Categories will be populated by JavaScript -->
                    </div>
                    
                    <div class="seo-recommendations" id="seo-recommendations">
                        <!-- Recommendations will be populated by JavaScript -->
                    </div>
                </div>

                <!-- Loading State -->
                <div class="seo-loading" id="seo-loading" style="display: none;">
                    <div class="seo-spinner"></div>
                    <p>Analyzing SEO...</p>
                </div>
            </div>
        `;

    const formContainer = document.querySelector(".max-w-screen-2xl");
    if (formContainer) {
      const seoContainer = document.createElement("div");
      seoContainer.className = "max-w-screen-2xl mx-auto mt-6";
      seoContainer.appendChild(seoPanel);
      formContainer.parentNode.insertBefore(
        seoContainer,
        formContainer.nextSibling
      );
    } else {
      
      const editorWrapper = document.querySelector(".editor-wrapper");
      if (editorWrapper) {
        editorWrapper.parentNode.insertBefore(
          seoPanel,
          editorWrapper.nextSibling
        );
      } else {
        document.body.appendChild(seoPanel);
      }
    }

    console.log("SEO panel created and added to DOM:", seoPanel.id);
  }

  bindEvents() {
    
    const toggleBtn = document.getElementById("toggle-seo-panel");
    if (toggleBtn) {
      toggleBtn.addEventListener("click", () => this.togglePanel());
    }

    const analyzeBtn = document.getElementById("analyze-seo-btn");
    if (analyzeBtn) {
      analyzeBtn.addEventListener("click", () => this.analyzeSEO());
    }

    const analyzeSidebarBtn = document.getElementById("analyze-seo-sidebar");
    if (analyzeSidebarBtn) {
      analyzeSidebarBtn.addEventListener("click", () => this.analyzeSEO());
    }

    const suggestionsSidebarBtn = document.getElementById(
      "seo-suggestions-sidebar"
    );
    if (suggestionsSidebarBtn) {
      suggestionsSidebarBtn.addEventListener("click", () =>
        this.getSEOSuggestions()
      );
    }

    const titleInput = document.getElementById("blogTitle");
    const slugInput = document.getElementById("seo-slug");
    const slugSidebarInput = document.getElementById("seo-slug-sidebar");

    if (titleInput) {
      titleInput.addEventListener("input", () => {
        const generatedSlug = this.generateSlug(titleInput.value);
        let slugUpdated = false;

        if (slugInput && !slugInput.value) {
          slugInput.value = generatedSlug;
          slugUpdated = true;
        }

        if (slugSidebarInput && !slugSidebarInput.value) {
          slugSidebarInput.value = generatedSlug;
          slugUpdated = true;
        }

        if (slugUpdated && typeof window.syncAdvancedSeoHiddenFields === "function") {
          window.syncAdvancedSeoHiddenFields();
        }
      });
    }

    const metaDesc = document.getElementById("seo-meta-description");
    const metaDescSidebar = document.getElementById(
      "seo-meta-description-sidebar"
    );

    if (metaDesc) {
      metaDesc.addEventListener("input", () => this.updateCharCount());
    }

    if (metaDescSidebar) {
      metaDescSidebar.addEventListener("input", () =>
        this.updateCharCountSidebar()
      );
    }

    this.setupAutoAnalysis();

    this.setupFieldSync();

    this.setupMobileToggle();
  }

  setupAutoAnalysis() {
    let timeout;
    const inputs = [
      document.getElementById("blogTitle"),
      document.getElementById("editor"),
      document.getElementById("seo-focus-keyword"),
      document.getElementById("seo-meta-description"),
    ].filter((el) => el);

    inputs.forEach((input) => {
      const event = input.id === "editor" ? "input" : "input";
      input.addEventListener(event, () => {
        clearTimeout(timeout);
        timeout = setTimeout(() => {
          if (this.shouldAutoAnalyze()) {
            this.analyzeSEO();
          }
        }, 2000); 
      });
    });
  }

  shouldAutoAnalyze() {
    const title = document.getElementById("blogTitle")?.value;
    const content = document.getElementById("editor")?.innerHTML;
    const keyword = document.getElementById("seo-focus-keyword")?.value;

    return title && content && keyword; 
  }

  togglePanel() {
    const panel = document.getElementById("seo-panel");
    const toggleBtn = document.getElementById("toggle-seo-panel");
    const icon = toggleBtn?.querySelector(".material-symbols-outlined");

    if (panel.classList.contains("collapsed")) {
      panel.classList.remove("collapsed");
      if (icon) icon.textContent = "expand_less";
    } else {
      panel.classList.add("collapsed");
      if (icon) icon.textContent = "expand_more";
    }
  }

  generateSlug(text) {
    return text
      .toLowerCase()
      .trim()
      .replace(/[^\w\s-]/g, "")
      .replace(/[\s_-]+/g, "-")
      .replace(/^-+|-+$/g, "");
  }

  setupFieldSync() {
    const fieldPairs = [
      ["seo-focus-keyword", "seo-focus-keyword-sidebar"],
      ["seo-meta-description", "seo-meta-description-sidebar"],
      ["seo-slug", "seo-slug-sidebar"],
    ];

    fieldPairs.forEach(([mainId, sidebarId]) => {
      const mainField = document.getElementById(mainId);
      const sidebarField = document.getElementById(sidebarId);

      if (mainField && sidebarField) {
        
        mainField.addEventListener("input", () => {
          sidebarField.value = mainField.value;
          if (mainId.includes("meta-description")) {
            this.updateCharCountSidebar();
          }
          if (
            (mainId === "seo-slug" || sidebarId === "seo-slug-sidebar") &&
            typeof window.syncAdvancedSeoHiddenFields === "function"
          ) {
            window.syncAdvancedSeoHiddenFields();
          }
        });

        sidebarField.addEventListener("input", () => {
          mainField.value = sidebarField.value;
          if (mainId.includes("meta-description")) {
            this.updateCharCount();
          }
          if (
            sidebarId === "seo-slug-sidebar" &&
            typeof window.syncAdvancedSeoHiddenFields === "function"
          ) {
            window.syncAdvancedSeoHiddenFields();
          }
        });
      }
    });
  }

  setupMobileToggle() {
    const mobileToggle = document.getElementById("mobile-ai-toggle");
    const aiToolsPane = document.getElementById("ai-tools-pane");

    if (mobileToggle && aiToolsPane) {
      mobileToggle.addEventListener("click", () => {
        aiToolsPane.classList.toggle("mobile-open");

        const icon = mobileToggle.querySelector(".material-symbols-outlined");
        if (aiToolsPane.classList.contains("mobile-open")) {
          icon.textContent = "close";
        } else {
          icon.textContent = "psychology";
        }
      });

      document.addEventListener("click", (e) => {
        if (
          window.innerWidth <= 768 &&
          !aiToolsPane.contains(e.target) &&
          !mobileToggle.contains(e.target) &&
          aiToolsPane.classList.contains("mobile-open")
        ) {
          aiToolsPane.classList.remove("mobile-open");
          const icon = mobileToggle.querySelector(".material-symbols-outlined");
          icon.textContent = "psychology";
        }
      });

      document.addEventListener("keydown", (e) => {
        if (
          e.key === "Escape" &&
          aiToolsPane.classList.contains("mobile-open")
        ) {
          aiToolsPane.classList.remove("mobile-open");
          const icon = mobileToggle.querySelector(".material-symbols-outlined");
          icon.textContent = "psychology";
        }
      });
    }
  }

  updateCharCount() {
    const metaDesc = document.getElementById("seo-meta-description");
    const charCount = document.querySelector(".char-count");

    if (metaDesc && charCount) {
      const length = metaDesc.value.length;
      charCount.textContent = `${length}/160 characters`;

      if (length > 160) {
        charCount.style.color = "#ef4444";
      } else if (length < 120) {
        charCount.style.color = "#f59e0b";
      } else {
        charCount.style.color = "#10b981";
      }
    }
  }

  updateCharCountSidebar() {
    const metaDescSidebar = document.getElementById(
      "seo-meta-description-sidebar"
    );
    const charCountSidebar = document.querySelector(".char-count-sidebar");

    if (metaDescSidebar && charCountSidebar) {
      const length = metaDescSidebar.value.length;
      charCountSidebar.textContent = `${length}/160`;

      charCountSidebar.classList.remove("warning", "error", "success");

      if (length > 160) {
        charCountSidebar.classList.add("error");
      } else if (length < 120) {
        charCountSidebar.classList.add("warning");
      } else {
        charCountSidebar.classList.add("success");
      }

      if (length > 160) {
        metaDescSidebar.style.borderColor = "#ef4444";
      } else if (length >= 150) {
        metaDescSidebar.style.borderColor = "#10b981";
      } else {
        metaDescSidebar.style.borderColor = "#e5e7eb";
      }
    }
  }

  async getSEOSuggestions() {
    try {
      const content =
        window.editorUtils?.cleanContent(
          document.getElementById("editor")?.innerHTML
        ) || "";
      const title = document.getElementById("blogTitle")?.value || "";

      const response = await fetch("/api/seo/keyword-suggestions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ content, title }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();
      console.log('SEO suggestions API response:', result);

      if (result.success) {
        console.log('Suggestions array:', result.suggestions);
        this.showSuggestions(result.suggestions);
      } else {
        throw new Error(result.message || "Failed to get suggestions");
      }
    } catch (error) {
      console.error("SEO Suggestions error:", error);

      if (window.updateSEOModalData && window.showSEOModal) {
        const errorData = {
          overallScore: 0,
          recommendations: [
            {
              title: "Suggestions Failed",
              description: `Failed to get SEO suggestions: ${error.message}. Please try again with more content.`
            }
          ]
        };
        
        window.updateSEOModalData(errorData);
        window.showSEOModal();
      } else {
        alert("Failed to get SEO suggestions: " + error.message);
      }
    }
  }

  showSuggestions(suggestions) {
    console.log('Raw suggestions received:', suggestions);
    
    if (!suggestions || suggestions.length === 0) {
      
      if (window.updateSEOModalData && window.showSEOModal) {
        const noSuggestionData = {
          overallScore: 0,
          recommendations: [
            {
              title: "No Content Available",
              description: "No keyword suggestions found. Try adding more content to your blog post to generate keyword suggestions."
            }
          ]
        };
        
        window.updateSEOModalData(noSuggestionData);
        window.showSEOModal();
      } else {
        this.showMessage(
          "No keyword suggestions found. Try adding more content to your blog post.",
          "warning"
        );
      }
      return;
    }

    const processedSuggestions = suggestions
      .slice(0, 10)
      .map((suggestion, index) => {
        console.log(`Processing suggestion ${index}:`, suggestion, typeof suggestion);
        
        if (!suggestion) return "";

        if (typeof suggestion === "string") {
          console.log(`String suggestion: ${suggestion}`);
          return suggestion;
        }

        if (typeof suggestion === "object" && suggestion !== null) {
          const keyword = suggestion.word || suggestion.keyword || suggestion.text || "";
          const count = suggestion.count;
          
          console.log(`Object suggestion - keyword: ${keyword}, count: ${count}`);
          
          if (keyword) {
            const result = count && typeof count === "number" ? `${keyword} (${count})` : keyword;
            console.log(`Formatted result: ${result}`);
            return result;
          }

          console.warn('Unrecognized suggestion object structure:', Object.keys(suggestion), suggestion);
          return `Unknown: ${JSON.stringify(suggestion)}`;
        }

        console.log(`Other type (${typeof suggestion}):`, suggestion);
        return String(suggestion);
      })
      .filter(Boolean);

    console.log('Processed suggestions array:', processedSuggestions);
    
    const formattedSuggestions = processedSuggestions.join(", ");

    if (!formattedSuggestions) {
      
      if (window.updateSEOModalData && window.showSEOModal) {
        const noSuggestionData = {
          overallScore: 0,
          recommendations: [
            {
              title: "No Keywords Found",
              description: "No keyword suggestions found. Try adding more content to your blog post to generate better keyword suggestions."
            }
          ]
        };
        
        window.updateSEOModalData(noSuggestionData);
        window.showSEOModal();
      } else {
        this.showMessage(
          "No keyword suggestions found. Try adding more content to your blog post.",
          "warning"
        );
      }
      return;
    }

    console.log('Formatted suggestions:', formattedSuggestions);

    if (window.updateSEOModalData && window.showSEOModal) {
      
      const suggestionData = {
        overallScore: 0,
        recommendations: [
          {
            title: "Keyword Suggestions",
            description: `Consider using these keywords in your content: ${formattedSuggestions}. Use these keywords naturally throughout your content for better SEO.`
          }
        ]
      };
      
      window.updateSEOModalData(suggestionData);
      window.showSEOModal();
    } else {
      
      this.showMessage(
        `SEO Keyword Suggestions:\n\n${formattedSuggestions}\n\nTip: Use these keywords naturally in your content for better SEO.`,
        "info"
      );
    }
  }

  setButtonLoading(isLoading) {
    const buttons = [
      document.getElementById("analyze-seo-sidebar"),
      document.getElementById("analyze-seo-btn"),
      document.getElementById("seo-suggestions-sidebar"),
    ];

    buttons.forEach((button) => {
      if (button) {
        if (isLoading) {
          button.classList.add("seo-loading-button");
          button.disabled = true;
          const icon = button.querySelector(".material-symbols-outlined");
          if (icon) {
            icon.dataset.originalText = icon.textContent;
            icon.textContent = "hourglass_empty";
          }
        } else {
          button.classList.remove("seo-loading-button");
          button.disabled = false;
          const icon = button.querySelector(".material-symbols-outlined");
          if (icon && icon.dataset.originalText) {
            icon.textContent = icon.dataset.originalText;
          }
        }
      }
    });
  }

  showSuccessMessage(message) {
    this.showMessage(message, "success");
  }

  showMessage(message, type = "info") {
    
    const toast = document.createElement("div");
    toast.className = `fixed bottom-4 right-4 z-50 px-6 py-3 rounded-lg shadow-lg text-white text-sm font-medium max-w-sm transform translate-y-full transition-transform duration-300`;

    switch (type) {
      case "success":
        toast.className += " bg-green-600";
        break;
      case "error":
        toast.className += " bg-red-600";
        break;
      case "warning":
        toast.className += " bg-yellow-600";
        break;
      default:
        toast.className += " bg-blue-600";
    }

    toast.textContent = message;
    document.body.appendChild(toast);

    setTimeout(() => {
      toast.style.transform = "translateY(0)";
    }, 100);

    setTimeout(() => {
      toast.style.transform = "translateY(full)";
      setTimeout(() => {
        if (toast.parentNode) {
          toast.parentNode.removeChild(toast);
        }
      }, 300);
    }, 4000);
  }

  async analyzeSEO() {
    if (this.isAnalyzing) return;

    this.isAnalyzing = true;
    this.showLoading();
    this.setButtonLoading(true);

    try {
      
      const seoData = this.collectSEOData();

      if (!seoData.content || seoData.content.length < 50) {
        throw new Error(
          "Please add more content to your blog post (minimum 50 characters)"
        );
      }

      const response = await fetch("/api/seo/analyze", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(seoData),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();

      if (result.success) {
        this.analysisResult = result.data;

        if (window.updateSEOModalData && window.showSEOModal) {
          const seoData = result.data.seoScore || result.data;
          window.updateSEOModalData(seoData);
          window.showSEOModal();

          const miniScore = document.getElementById('mini-seo-score');
          if (miniScore && seoData.overallScore !== undefined) {
            miniScore.textContent = `SEO: ${Math.round(seoData.overallScore)}`;
            miniScore.classList.remove('hidden');
          }
        } else {
          
          this.displayResults(result.data);
          console.log("SEO analysis completed successfully!");
        }
      } else {
        throw new Error(result.message || "Analysis failed");
      }
    } catch (error) {
      console.error("SEO Analysis error:", error);

      if (window.updateSEOModalData && window.showSEOModal) {
        const errorData = {
          overallScore: 0,
          recommendations: [
            {
              title: "Analysis Failed",
              description: `SEO analysis failed: ${error.message}. Please try again or check your content.`
            }
          ]
        };
        
        window.updateSEOModalData(errorData);
        window.showSEOModal();
      } else {
        this.showError("SEO analysis failed: " + error.message);
      }
    } finally {
      this.isAnalyzing = false;
      this.hideLoading();
      this.setButtonLoading(false);
    }
  }

  collectSEOData() {
    return {
      title: document.getElementById("blogTitle")?.value || "",
      content:
        window.editorUtils?.cleanContent(
          document.getElementById("editor")?.innerHTML
        ) || "",
      metaDescription:
        document.getElementById("seo-meta-description")?.value ||
        document.getElementById("seo-meta-description-sidebar")?.value ||
        "",
      focusKeyword:
        document.getElementById("seo-focus-keyword")?.value ||
        document.getElementById("seo-focus-keyword-sidebar")?.value ||
        "",
      slug:
        document.getElementById("seo-slug")?.value ||
        document.getElementById("seo-slug-sidebar")?.value ||
        "",
    };
  }

  showLoading() {
    const loading = document.getElementById("seo-loading");
    const scoreContainer = document.getElementById("seo-score-container");

    if (loading) loading.style.display = "block";
    if (scoreContainer) scoreContainer.style.display = "none";
  }

  hideLoading() {
    const loading = document.getElementById("seo-loading");
    if (loading) loading.style.display = "none";
  }

  displayResults(data) {
    const scoreContainer = document.getElementById("seo-score-container");
    if (scoreContainer) {
      scoreContainer.style.display = "block";

      this.updateScore(data.seoScore.overallScore);

      this.updateCategories(data.seoScore.categoryScores);

      this.updateRecommendations(data.seoScore.recommendations);
    }

    this.updateSidebarScore(data.seoScore.overallScore);
  }

  updateScore(score) {
    const scoreNumber = document.getElementById("seo-score-number");
    const scoreTitle = document.getElementById("seo-score-title");
    const scoreStatus = document.getElementById("seo-score-status");
    const scoreCircle = document.querySelector(".seo-score-circle");

    if (scoreNumber) scoreNumber.textContent = score;

    let status, color;
    if (score >= 80) {
      status = "Excellent SEO";
      color = "#10b981";
    } else if (score >= 60) {
      status = "Good SEO";
      color = "#f59e0b";
    } else {
      status = "Needs Improvement";
      color = "#ef4444";
    }

    if (scoreStatus) scoreStatus.textContent = status;
    if (scoreCircle) {
      scoreCircle.style.background = `conic-gradient(${color} ${score}%, #e5e7eb ${score}%)`;
    }
  }

  updateSidebarScore(score) {
    const scoreNumberSidebar = document.getElementById(
      "seo-score-number-sidebar"
    );
    const scoreBarSidebar = document.getElementById("seo-score-bar-sidebar");
    const scoreStatusSidebar = document.getElementById(
      "seo-score-status-sidebar"
    );
    const scoreContainer = document.getElementById("seo-score-sidebar");

    if (scoreContainer) {
      scoreContainer.classList.remove("hidden");
    }

    if (scoreNumberSidebar) {
      scoreNumberSidebar.textContent = score;
    }

    if (scoreBarSidebar) {
      scoreBarSidebar.style.width = `${score}%`;

      if (score >= 80) {
        scoreBarSidebar.className =
          "bg-gradient-to-r from-green-500 to-green-600 h-2 rounded-full transition-all duration-500";
      } else if (score >= 60) {
        scoreBarSidebar.className =
          "bg-gradient-to-r from-yellow-500 to-yellow-600 h-2 rounded-full transition-all duration-500";
      } else {
        scoreBarSidebar.className =
          "bg-gradient-to-r from-red-500 to-red-600 h-2 rounded-full transition-all duration-500";
      }
    }

    if (scoreStatusSidebar) {
      let status;
      if (score >= 80) {
        status = "Excellent";
      } else if (score >= 60) {
        status = "Good";
      } else {
        status = "Needs work";
      }
      scoreStatusSidebar.textContent = status;
    }
  }

  updateCategories(categories) {
    const container = document.getElementById("seo-categories");
    if (!container) return;

    container.innerHTML = "<h4>Category Breakdown</h4>";

    Object.entries(categories).forEach(([category, data]) => {
      const categoryEl = document.createElement("div");
      categoryEl.className = "seo-category";

      const percentage = Math.round(data.percentage);
      let color = "#ef4444";
      if (percentage >= 80) color = "#10b981";
      else if (percentage >= 60) color = "#f59e0b";

      categoryEl.innerHTML = `
                <div class="category-header">
                    <span class="category-name">${this.formatCategoryName(
                      category
                    )}</span>
                    <span class="category-score">${data.score}/${
        data.maxScore
      }</span>
                </div>
                <div class="category-bar">
                    <div class="category-progress" style="width: ${percentage}%; background-color: ${color};"></div>
                </div>
            `;

      container.appendChild(categoryEl);
    });
  }

  updateRecommendations(recommendations) {
    const container = document.getElementById("seo-recommendations");
    if (!container) return;

    if (recommendations.length === 0) {
      container.innerHTML =
        '<div class="no-recommendations"><h4>🎉 Great job!</h4><p>No major SEO issues found.</p></div>';
      return;
    }

    container.innerHTML = "<h4>Recommendations</h4>";

    recommendations.forEach((rec) => {
      const recEl = document.createElement("div");
      recEl.className = `seo-recommendation priority-${rec.priority}`;

      recEl.innerHTML = `
                <div class="rec-header">
                    <span class="rec-icon">${
                      rec.priority === "high" ? "🚨" : "⚠️"
                    }</span>
                    <h5>${rec.category}</h5>
                </div>
                <ul class="rec-issues">
                    ${rec.issues.map((issue) => `<li>${issue}</li>`).join("")}
                </ul>
            `;

      container.appendChild(recEl);
    });
  }

  formatCategoryName(category) {
    const names = {
      keyword: "Keyword Usage",
      content: "Content Quality",
      meta: "Meta Tags",
      structure: "Content Structure",
      links: "Links",
      images: "Images",
      readability: "Readability",
    };
    return names[category] || category;
  }

  showError(message) {
    const container = document.getElementById("seo-score-container");
    if (!container) return;

    container.style.display = "block";
    container.innerHTML = `
            <div class="seo-error">
                <span class="material-symbols-outlined">error</span>
                <p>${message}</p>
                <button type="button" onclick="seoTools.analyzeSEO()" class="retry-btn">Try Again</button>
            </div>
        `;
  }

  getAnalysisResult() {
    return this.analysisResult;
  }

  canPublish() {
    return (
      this.analysisResult && this.analysisResult.seoScore.overallScore >= 70
    );
  }

  async getFleschReadingEase() {
    const content =
      window.editorUtils?.cleanContent(
        document.getElementById("editor")?.innerHTML
      ) || "";

    if (!content) {
      return {
        score: 0,
        grade: "No content",
        wordCount: 0,
        sentenceCount: 0,
        avgWordsPerSentence: 0,
        avgSyllablesPerWord: 0,
      };
    }

    try {
      const response = await fetch("/api/seo/flesch-reading-ease", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ content }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();

      if (result.success) {
        return result.data;
      } else {
        throw new Error(
          result.message || "Failed to calculate Flesch Reading Ease"
        );
      }
    } catch (error) {
      console.error("Flesch Reading Ease calculation error:", error);
      return {
        score: 0,
        grade: "Error calculating",
        wordCount: 0,
        sentenceCount: 0,
        avgWordsPerSentence: 0,
        avgSyllablesPerWord: 0,
        error: error.message,
      };
    }
  }
}

const seoTools = new SEOTools();

window.seoTools = seoTools;
