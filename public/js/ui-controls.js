document.addEventListener("DOMContentLoaded", () => {
  
  const togglePreviewBtn = document.getElementById("togglePreviewBtn");
  const mainContainer = document.getElementById("main-container");
  const editorPane = document.getElementById("editor-pane");
  const previewPane = document.getElementById("preview-pane");
  const slider = document.getElementById("slider");
  const toggleToolbarBtn = document.getElementById("toggleToolbarBtn");
  const toolbarContent = document.getElementById("toolbar-content");

  let isPreviewVisible = true;

  if (togglePreviewBtn) {
    togglePreviewBtn.addEventListener("click", () => {
      isPreviewVisible = !isPreviewVisible;
      if (previewPane)
        previewPane.classList.toggle("hidden", !isPreviewVisible);
      if (slider) slider.classList.toggle("hidden", !isPreviewVisible);

      if (isPreviewVisible) {
        if (editorPane) editorPane.style.width = "50%";
        togglePreviewBtn.innerHTML =
          '<span class="material-symbols-outlined">visibility_off</span>';
        togglePreviewBtn.title = "Hide Preview";
      } else {
        if (editorPane) editorPane.style.width = "100%";
        togglePreviewBtn.innerHTML =
          '<span class="material-symbols-outlined">visibility</span>';
        togglePreviewBtn.title = "Show Preview";
      }
    });
  }

  if (toggleToolbarBtn) {
    toggleToolbarBtn.addEventListener("click", () => {
      const isHidden = toolbarContent.classList.toggle("hidden");
      toggleToolbarBtn.innerHTML = `<span class="material-symbols-outlined">${
        isHidden ? "keyboard_arrow_down" : "keyboard_arrow_up"
      }</span>`;
      toggleToolbarBtn.title = isHidden ? "Show Toolbar" : "Hide Toolbar";
    });
  }

  let isDragging = false;

  if (slider) {
    slider.addEventListener("mousedown", (e) => {
      isDragging = true;
      document.body.style.cursor = "col-resize";
      document.body.style.userSelect = "none";
      e.preventDefault();
    });
  }

  document.addEventListener("mouseup", () => {
    if (isDragging) {
      isDragging = false;
      document.body.style.cursor = "default";
      document.body.style.userSelect = "auto";
    }
  });

  document.addEventListener("mousemove", (e) => {
    if (!isDragging || !mainContainer || !slider || !editorPane || !previewPane)
      return;

    const containerRect = mainContainer.getBoundingClientRect();
    const sliderWidth = slider.offsetWidth;
    const newEditorWidth = e.clientX - containerRect.left - sliderWidth / 2;
    const containerWidth = containerRect.width;
    const newPreviewWidth = containerWidth - newEditorWidth - sliderWidth;

    if (newEditorWidth > 100 && newPreviewWidth > 100) {
      const editorPercent = (newEditorWidth / containerWidth) * 100;
      const previewPercent = (newPreviewWidth / containerWidth) * 100;

      editorPane.style.width = `${editorPercent}%`;
      previewPane.style.width = `${previewPercent}%`;
    }
  });

  const xmlToggle = document.getElementById("xml-toggle");
  const xmlToggleHandle = document.getElementById("xml-toggle-handle");
  const xmlView = document.getElementById("xml-view");
  const editor = document.getElementById("editor");
  let isXmlView = false;

  function generateXmlFromHtml(html) {
    try {
      if (window.editorUtils && typeof window.editorUtils.cleanContentForStorage === 'function') {
        html = window.editorUtils.cleanContentForStorage(html);
      }
    } catch (e) {
      console.warn('XML cleanContentForStorage failed, using raw HTML');
    }
    const parser = new DOMParser();
    const doc = parser.parseFromString(`<div>${html}</div>`, "text/html");
    const ALLOWED_ATTRS = {
      a: new Set(['href','title','target','rel']),
      img: new Set(['src','alt','title','width','height']),
      table: new Set([]), thead: new Set([]), tbody: new Set([]), tfoot: new Set([]),
      tr: new Set([]), th: new Set(['colspan','rowspan','scope']), td: new Set(['colspan','rowspan']),
      ul: new Set([]), ol: new Set([]), li: new Set([]),
      p: new Set(['id']),
      h1: new Set(['id']), h2: new Set(['id']), h3: new Set(['id']), h4: new Set(['id']), h5: new Set(['id']), h6: new Set(['id']),
      strong: new Set([]), b: new Set([]), em: new Set([]), i: new Set([]), u: new Set([]), s: new Set([]),
      blockquote: new Set(['cite']), code: new Set([]), pre: new Set([]), br: new Set([]),
    };

    function nodeToXml(node) {
      if (node.nodeType === 3) {
        return node.textContent.trim()
          ? node.textContent
              .replace(/&/g, "&amp;")
              .replace(/</g, "&lt;")
              .replace(/>/g, "&gt;")
              .replace(/"/g, "&quot;")
              .replace(/'/g, "&apos;")
          : "";
      }
      if (node.nodeType !== 1) return "";

      const tagName = node.tagName.toLowerCase();
      const allowed = ALLOWED_ATTRS[tagName] || new Set();
      const attrs = Array.from(node.attributes)
        .filter(attr => allowed.has(attr.name.toLowerCase()))
        .map((attr) => `${attr.name}="${attr.value
              .replace(/&/g, "&amp;")
              .replace(/</g, "&lt;")
              .replace(/>/g, "&gt;")
              .replace(/"/g, "&quot;")
              .replace(/'/g, "&apos;")}"`)
        .join(" ");
      const children = Array.from(node.childNodes).map(nodeToXml).join("");
      return attrs
        ? `<${tagName} ${attrs}>${children}</${tagName}>`
        : `<${tagName}>${children}</${tagName}>`;
    }

    const xmlContent = Array.from(doc.body.firstChild.childNodes)
      .map(nodeToXml)
      .join("\n");
    return `<document>\n${xmlContent}\n</document>`;
  }

  function generateHtmlFromXml(xmlString) {
    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(xmlString, "application/xml");
    const parseError = xmlDoc.querySelector("parsererror");
    if (parseError) {
      throw new Error("Invalid XML structure.");
    }

    const documentNode = xmlDoc.querySelector("document");
    if (!documentNode) {
      throw new Error("<document> root tag not found.");
    }

    const serializer = new XMLSerializer();
    let htmlResult = "";
    documentNode.childNodes.forEach((node) => {
      if (node.nodeType === 1) {
        htmlResult += serializer.serializeToString(node);
      }
    });
    return htmlResult;
  }

  if (xmlToggle && xmlToggleHandle && xmlView && editor) {
    xmlToggle.addEventListener("click", () => {
      isXmlView = !isXmlView;
      if (isXmlView) {
        xmlToggle.classList.add("bg-blue-600");
        xmlToggleHandle.style.transform = "translateX(1.25rem)";
        editor.classList.add("hidden");
        xmlView.classList.remove("hidden");
        xmlView.value = generateXmlFromHtml(editor.innerHTML);
      } else {
        try {
          const newHtml = generateHtmlFromXml(xmlView.value);
          editor.innerHTML = newHtml;
          if (window.editorUtils) {
            window.editorUtils.updatePreview();
          }

          xmlToggle.classList.remove("bg-blue-600");
          xmlToggleHandle.style.transform = "translateX(0.25rem)";
          editor.classList.remove("hidden");
          xmlView.classList.add("hidden");
        } catch (error) {
          console.error("XML Parsing Error:", error);
          if (window.editorUtils) {
            window.editorUtils.flash(
              "Invalid XML format. Please correct it before switching back."
            );
          }
          isXmlView = true; 
        }
      }
    });
  }
});
