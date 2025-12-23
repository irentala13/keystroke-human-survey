  // Keystroke Analysis Survey - Loading features from pre-calculated JSON files
  // 
  // To use this file:
  // 1. Run final-fe-json.py to create the JSON files in the features_json directory
  // 2. Run generate_survey_data_from_json.py to create survey_data_from_json.js
  // 3. Include chroma.js library in your HTML file:
  //    <script src="https://cdn.jsdelivr.net/npm/chroma-js@2.4.2/chroma.min.js"></script>
  // 4. Include both files in editor.p5js.org index.html file:
  //    <script src="survey_data_from_json.js"></script>
  //    <script src="text-keystroke-analysis-survey-from-json.js"></script>

  // ============================================================================
  // CONSTANTS
  // ============================================================================

  const COLORS = {
    BACKGROUND: 240,
    TEXT_PRIMARY: 50,
    TEXT_SECONDARY: 60,
    TEXT_TERTIARY: 80,
    TEXT_QUATERNARY: 100,
    BOX_STROKE: 200,
    GRID_LINE: 230,
    SELECTED_BUTTON: '#28A745',
    SELECTED_BUTTON_HOVER: '#218838',
    SELECTED_BUTTON_BORDER: '#1E7E34',
    DEFAULT_BUTTON: '#6C757D',
    DEFAULT_BUTTON_HOVER: '#5A6268',
    NAV_BUTTON_ENABLED: '#4CAF50',
    NAV_BUTTON_ENABLED_HOVER: '#45a049',
    NAV_BUTTON_DISABLED: '#CCCCCC',
    EMAIL_BUTTON: '#4CAF50',
    EMAIL_BUTTON_SENDING: '#ffc107',
    EMAIL_BUTTON_SUCCESS: '#28a745'
  };

  const DIMENSIONS = {
    CANVAS_MIN_HEIGHT: 1600,
    MOBILE_BREAKPOINT: 768,
    TEXT_BOX_HEIGHT: 180,
    TEXT_BOX_PADDING: 15,
    HEATMAP_HEIGHT: 220,
    HISTOGRAM_HEIGHT: 280,
    LABEL_WIDTH: 85,
    GRAPH_SPACING: 40,
    TITLE_HEIGHT: 30,
    RESPONSE_BUTTON_HEIGHT: 50,
    NAV_BUTTON_HEIGHT_MOBILE: 45,
    NAV_BUTTON_HEIGHT_DESKTOP: 50,
    NAV_BUTTON_WIDTH_MOBILE: 100,
    NAV_BUTTON_WIDTH_DESKTOP: 120
  };

  const SPACING = {
    MARGIN_MOBILE: 30,
    MARGIN_DESKTOP: 50,
    INTRO_MARGIN_MOBILE: 30,
    INTRO_MARGIN_DESKTOP: 60,
    BOTTOM_MARGIN_MOBILE: 20,
    BOTTOM_MARGIN_DESKTOP: 30,
    BUTTON_SPACING: 15,
    TEXT_SPACING: 50,
    GRAPH_BOTTOM_SPACING: 50
  };

  // ============================================================================
  // EMAILJS CONFIGURATION
  // ============================================================================
  // Security: Load from external config.js (gitignored) to avoid exposing
  // credentials in public repositories. Falls back to placeholder values.
  // 
  // To use: Copy config.example.js to config.js and fill in your values
  // See SECURITY.md for detailed security guidance
  
  // EMAIL_CONFIG getter function - checks dynamically for EMAIL_CONFIG_OVERRIDE
  // This ensures config.js values are used even if loaded after script initialization
  function getEmailConfig() {
    // Check if config override exists (loaded from config.js)
    // Check both global scope and window object
    const configOverride = (typeof EMAIL_CONFIG_OVERRIDE !== 'undefined' && EMAIL_CONFIG_OVERRIDE) 
      ? EMAIL_CONFIG_OVERRIDE 
      : (typeof window !== 'undefined' && window.EMAIL_CONFIG_OVERRIDE) 
        ? window.EMAIL_CONFIG_OVERRIDE 
        : null;
    
    if (configOverride) {
      // Validate config structure
      const required = ['SERVICE_ID', 'TEMPLATE_ID', 'USER_ID', 'TO_EMAIL', 'API_URL'];
      const missing = required.filter(key => !EMAIL_CONFIG_OVERRIDE[key] || 
        EMAIL_CONFIG_OVERRIDE[key].includes('your_') || 
        EMAIL_CONFIG_OVERRIDE[key].includes('example.com'));
      
      if (missing.length === 0) {
        return configOverride;
      } else {
        console.warn('⚠️ config.js found but contains placeholder values. Using fallback.');
      }
    }
    
    // Fallback: Use placeholder values (should be replaced in production)
    return {
      SERVICE_ID: 'service_u4bf0vt',
      TEMPLATE_ID: 'template_xkica83',
      USER_ID: 'C8w46dTZQHztZTpKB',
      TO_EMAIL: 'irentala@my.harrisburgu.edu',
      API_URL: 'https://api.emailjs.com/api/v1.0/email/send'
    };
  }
  
  // EMAIL_CONFIG - use getter function to access current config
  // This ensures we always check for EMAIL_CONFIG_OVERRIDE dynamically
  const EMAIL_CONFIG = {
    get SERVICE_ID() { return getEmailConfig().SERVICE_ID; },
    get TEMPLATE_ID() { return getEmailConfig().TEMPLATE_ID; },
    get USER_ID() { return getEmailConfig().USER_ID; },
    get TO_EMAIL() { return getEmailConfig().TO_EMAIL; },
    get API_URL() { return getEmailConfig().API_URL; }
  };
  
  // Log which config is being used (check once at initialization)
  (function() {
    const config = getEmailConfig();
    if (typeof EMAIL_CONFIG_OVERRIDE !== 'undefined' && EMAIL_CONFIG_OVERRIDE) {
      console.log('✅ Using EmailJS config from config.js');
    } else {
      console.warn('⚠️ Using default EmailJS config. For production, create config.js with your credentials.');
    }
  })();

  // ============================================================================
  // STATE VARIABLES
  // ============================================================================

  let textPairs = [];
  let currentPair = 0;
  let userResponses = [];
  let buttons = [];
  let navButtons = [];
  let isLoading = true;
  let isComplete = false;
  let surveyStarted = false;
  let canvas; // Store canvas reference globally

  // Convert JSON feature format to UI format
  // Only includes the 5 features used in the visualization:
  // 1. WPM, 2. Avg KHT, 3. Avg KIT, 4. Pause Histogram, 5. Burst Histogram
  function convertJsonFeaturesToUI(jsonFeatures, textContent) {
    return {
      content: textContent || "",
      keystrokeData: {
        // Feature 1: WPM (Words Per Minute)
        avgTypingSpeed: jsonFeatures.WPM || 50,
        
        // Feature 2: Avg KHT (Average Key Hold Time)
        avgKeyHoldTime: jsonFeatures.Average_KHT || 100,
        
        // Feature 3: Avg KIT (Average Key Interval Time)
        avgKeyInterval: jsonFeatures.Average_KIT || 150,
        
        // Feature 4: Pause Histogram
        pauseHistogram: jsonFeatures.PauseHistogram || [],
        
        // Feature 5: Burst Histogram
        burstHistogram: jsonFeatures.BurstHistogram || []
      }
    };
  }


  // Load data from generated survey_data_from_json.js file
  function loadDataFromGeneratedFile() {
    if (typeof SURVEY_DATA_FROM_JSON === 'undefined') {
      console.error("SURVEY_DATA_FROM_JSON not found. Make sure survey_data_from_json.js is loaded first.");
      return false;
    }
    
    let data = SURVEY_DATA_FROM_JSON;
    textPairs = [];
    
    // Convert loaded data to UI format
    for (let pairData of data.textPairs || []) {
      textPairs.push({
        id: pairData.id,
        text1: convertJsonFeaturesToUI(pairData.text1.features, pairData.text1.text_content || ""),
        text2: convertJsonFeaturesToUI(pairData.text2.features, pairData.text2.text_content || ""),
        actualType: pairData.actualType,
        difficulty: pairData.difficulty || "MEDIUM"
      });
    }
    
    console.log(`Loaded ${textPairs.length} text pairs from JSON data`);
    return textPairs.length > 0;
  }

  function preload() {
    console.log("Loading keystroke features from JSON files...");
    // Data should be loaded via survey_data_from_json.js script tag
    // Check if data is available
    if (typeof SURVEY_DATA_FROM_JSON !== 'undefined') {
      loadDataFromGeneratedFile();
      isLoading = false;
    } else {
      console.warn("Waiting for survey_data_from_json.js to load...");
      // Try again after a short delay
      setTimeout(() => {
        if (typeof SURVEY_DATA_FROM_JSON !== 'undefined') {
          loadDataFromGeneratedFile();
          isLoading = false;
        } else {
          console.error("Failed to load survey data. Make sure survey_data_from_json.js is included.");
          isLoading = false;
        }
      }, 100);
    }
  }

  // ============================================================================
  // UTILITY FUNCTIONS
  // ============================================================================

  function scrollToTop() {
    window.scrollTo(0, 0);
  }

  function isMobileDevice() {
    return width < DIMENSIONS.MOBILE_BREAKPOINT;
  }

  function getResponsiveMargin() {
    return isMobileDevice() ? SPACING.MARGIN_MOBILE : SPACING.MARGIN_DESKTOP;
  }

  function cleanupButtons() {
    buttons.forEach(btn => btn.remove());
    navButtons.forEach(btn => btn.remove());
    buttons = [];
    navButtons = [];
  }

  // ============================================================================
  // SETUP & DRAW LOOP
  // ============================================================================

  function setup() {
    canvas = createCanvas(windowWidth, max(windowHeight, DIMENSIONS.CANVAS_MIN_HEIGHT));
    textAlign(LEFT, TOP);
    
    // Ensure canvas doesn't block button clicks - set pointer-events to none for canvas
    // Buttons will be on top and clickable
    canvas.elt.style.pointerEvents = 'none';
    
    // Don't create navigation UI until survey starts
  }

  function windowResized() {
    resizeCanvas(windowWidth, max(windowHeight, DIMENSIONS.CANVAS_MIN_HEIGHT));
    
    // Ensure canvas doesn't block button clicks
    if (canvas && canvas.elt) {
      canvas.elt.style.pointerEvents = 'none';
    }
    
    if (window.startBtn && !surveyStarted) {
      window.startBtn.remove();
      window.startBtn = null;
    }
    
    // Remove completion page elements to force recalculation on resize
    if (isComplete && window.sendEmailBtn) {
      window.sendEmailBtn.remove();
      window.sendEmailBtn = null;
    }
    
    // Only recreate navigation UI if survey has started
    if (surveyStarted) {
      createNavigationUI();
      // Recreate response buttons to update their positions
      if (buttons.length > 0) {
        createUI();
      }
    }
  }

  function draw() {
    background(COLORS.BACKGROUND);
    
    if (isLoading) {
      displayLoading();
      return;
    }
    
    if (isComplete) {
      displayCompletion();
      return;
    }
    
    if (!surveyStarted) {
      displayIntroPage();
      return;
    }
    
    if (currentPair < textPairs.length) {
      // Display the current pair - draw loop will automatically refresh when currentPair changes
      displayTextPair(textPairs[currentPair]);
      
      // Create UI buttons when survey starts and graph height is available
      // Check after displayTextPair so lastGraphEndY is set
      // Also check if buttons exist but are hidden (from going back to intro)
      if (surveyStarted && window.lastGraphEndY) {
        let buttonsNeedCreation = buttons.length === 0 || navButtons.length === 0;
        let buttonsAreHidden = buttons.length > 0 && buttons.every(btn => btn.elt.style.display === 'none');
        
        if (buttonsNeedCreation || buttonsAreHidden) {
          // Remove any existing hidden buttons first
          if (buttons.length > 0) {
            buttons.forEach(btn => btn.remove());
            buttons = [];
          }
          if (navButtons.length > 0) {
            navButtons.forEach(btn => btn.remove());
            navButtons = [];
          }
          // Create fresh buttons
          createUI();
          createNavigationUI();
        }
      }
      
      // Always update button highlights to reflect current state
      updateButtonHighlights();
      
      // Ensure buttons are visible and properly positioned
      if (buttons.length >= 2) {
        buttons.forEach(btn => {
          if (btn && btn.elt) {
            btn.elt.style.display = 'block';
            btn.elt.style.visibility = 'visible';
            btn.elt.style.opacity = '1';
            btn.elt.style.pointerEvents = 'auto';
          }
        });
      }
    }
  }

  // ============================================================================
  // DISPLAY FUNCTIONS
  // ============================================================================

  function displayLoading() {
    background(COLORS.BACKGROUND);
    textAlign(CENTER, CENTER);
    textSize(18);
    fill(COLORS.TEXT_SECONDARY);
    text("Loading keystroke features...", width / 2, height / 2);
  }

  function displayIntroPage() {
    background(COLORS.BACKGROUND);
    
    let isMobile = isMobileDevice();
    let margin = isMobile ? SPACING.INTRO_MARGIN_MOBILE : SPACING.INTRO_MARGIN_DESKTOP;
    let contentWidth = width - (2 * margin);
    
    let y = isMobile ? 40 : 60;
    
    // Title - Centered
    textAlign(CENTER, TOP);
    textSize(isMobile ? 22 : 28);
    textStyle(BOLD);
    fill(COLORS.TEXT_PRIMARY);
    text('Text + Keystroke Analysis Survey', width / 2, y);
    y += isMobile ? 35 : 45;
    
    // Subtitle - Centered
    textSize(isMobile ? 14 : 18);
    textStyle(NORMAL);
    fill(COLORS.TEXT_TERTIARY);
    text('Same User vs Different User Detection', width / 2, y);
    y += isMobile ? 30 : 40;
    
    // Body text - Left aligned
    textAlign(LEFT, TOP);
    let fontSize = isMobile ? 13 : 15;
    textSize(fontSize);
    textStyle(NORMAL);
    fill(COLORS.TEXT_SECONDARY);
    
    let introText = [
      "Dear Participant,",
      "",
      "We are developing advanced detection systems for identifying whether text samples come from the same user or different users. Your responses will help us understand how humans analyze text + keystroke patterns.",
      "",
      "Survey Instructions:",
      "1. You will be shown pairs of text samples with keystroke data.",
      "2. Each pair includes two text samples and their associated keystroke metrics.",
      "3. For each pair, determine if both texts come from the same user or different users.",
      "",
      "Understanding Keystroke Features:",
      "The following 5 features are used in the analysis:",
      "",
      "4. Consider these factors when making your decision:",
      "   - Writing style and language patterns",
      "   - Typing speed and rhythm",
      "   - Pause patterns and hesitation",
      "",
      "5. You can change your selection at any time before completing the survey.",
      "6. Use the 'Previous' and 'Next' buttons to navigate between pairs."
    ];
    
    let lineHeight = isMobile ? 22 : 26;
    
    // Draw text with proper wrapping and alignment
    let featuresStartY = 0;
    let featuresEndY = 0;
    
    for (let i = 0; i < introText.length; i++) {
      let line = introText[i];
      
      if (line === "Understanding Keystroke Features:") {
        featuresStartY = y;
      }
      
      if (line.trim() === "") {
        y += lineHeight * 0.5; // Smaller spacing for empty lines
      } else {
        // Use text wrapping for long lines
        text(line, margin, y, contentWidth);
        // Estimate wrapped height (approximate)
        let charsPerLine = isMobile ? 45 : 80;
        let wrappedLines = Math.max(1, Math.ceil(line.length / charsPerLine));
        y += lineHeight * wrappedLines;
        
        // Check if we've passed the features section
        if (line === "The following 5 features are used in the analysis:") {
          // Draw features with special formatting
          y += lineHeight * 0.5;
          featuresStartY = y;
          
          let features = [
            "WPM (Words Per Minute): Typing speed - measures how fast someone types.",
            "Avg KHT (Average Key Hold Time): How long keys are pressed down before release.",
            "Avg KIT (Average Key Interval Time): Time between releasing one key and pressing the next.",
            "Pause Histogram: Distribution of pause durations while typing.",
            "Burst Histogram: Distribution of typing burst lengths (consecutive keys without pauses)."
          ];
          
          // Draw features with special bullet style and indentation
          let featureIndent = isMobile ? 30 : 50;
          let featureLineHeight = isMobile ? 20 : 24;
          
          for (let j = 0; j < features.length; j++) {
            // Draw custom bullet (circle)
            fill(COLORS.TEXT_SECONDARY);
            noStroke();
            ellipse(margin + featureIndent - 8, y + fontSize * 0.35, 5, 5);
            
            // Draw feature text with extra indentation
            text(features[j], margin + featureIndent, y, contentWidth - featureIndent);
            
            // Estimate wrapped height
            let charsPerLine = isMobile ? 45 : 80;
            let wrappedLines = Math.max(1, Math.ceil(features[j].length / charsPerLine));
            y += featureLineHeight * wrappedLines;
          }
          
          featuresEndY = y;
          y += lineHeight * 0.5; // Add spacing after features
          continue; // Skip the rest of the loop for this iteration
        }
      }
    }
    
    // Button positioning - centered with proper spacing
    let buttonY = y + (isMobile ? 40 : 60);
    let buttonWidth = isMobile ? 180 : 220;
    let buttonHeight = isMobile ? 48 : 55;
    
    if (!window.startBtn && !surveyStarted) {
      window.startBtn = createButton('Start Analysis');
      window.startBtn.position(width / 2 - buttonWidth / 2, buttonY);
      window.startBtn.size(buttonWidth, buttonHeight);
      window.startBtn.style('font-size', isMobile ? '17px' : '19px');
      window.startBtn.style('font-weight', 'bold');
      window.startBtn.style('background-color', '#4CAF50');
      window.startBtn.style('color', 'white');
      window.startBtn.style('border', '2px solid #45a049');
      window.startBtn.style('border-radius', '8px');
      window.startBtn.style('cursor', 'pointer');
      window.startBtn.style('box-shadow', '0 4px 12px rgba(0,0,0,0.15)');
      window.startBtn.style('position', 'absolute');
      window.startBtn.style('z-index', '100');
      window.startBtn.mousePressed(() => {
        surveyStarted = true;
        window.startBtn.remove();
        window.startBtn = null;
        scrollToTop();
      });
    }
  }

  function displayTextPair(pair) {
    background(248, 248, 248);
    
    let margin = getResponsiveMargin();
    let contentWidth = width - (2 * margin);
    let y = 120;
    
    textAlign(LEFT, TOP);
    
    // Pair counter
    fill(COLORS.TEXT_QUATERNARY);
    textSize(16);
    textStyle(BOLD);
    text(`Text Pair ${currentPair + 1} of ${textPairs.length}`, margin, y);
    y += 40;
    
    // Draw text boxes
    y = drawTextBox(pair.text1.content, "Text Sample 1:", margin, y, contentWidth);
    y = drawTextBox(pair.text2.content, "Text Sample 2:", margin, y, contentWidth);
    
    y += SPACING.TEXT_SPACING;
    
    // Display visualizations for all 5 features and get final Y position
    let finalY = displayKeystrokeFeatureHeatmap(pair.text1.keystrokeData, pair.text2.keystrokeData, margin, y);
    
    // Store final Y position for button positioning
    window.lastGraphEndY = finalY;
  }

  function drawTextBox(content, label, x, y, boxWidth) {
    // Draw box background
    fill(255);
    stroke(COLORS.BOX_STROKE);
    strokeWeight(2);
    rect(x, y, boxWidth, DIMENSIONS.TEXT_BOX_HEIGHT);
    noStroke();
    
    // Draw label
    textAlign(LEFT, TOP);
    textStyle(BOLD);
    textSize(18);
    fill(COLORS.TEXT_SECONDARY);
    text(label, x + DIMENSIONS.TEXT_BOX_PADDING, y + 20);
    
    // Draw content
    textStyle(NORMAL);
    textSize(14);
    fill(COLORS.TEXT_TERTIARY);
    text(content || "[Text content not loaded]", 
        x + DIMENSIONS.TEXT_BOX_PADDING, 
        y + 50, 
        boxWidth - (2 * DIMENSIONS.TEXT_BOX_PADDING), 
        120);
    
    return y + DIMENSIONS.TEXT_BOX_HEIGHT;
  }

  // Display all 5 features: WPM, Avg KHT, Avg KIT, Pause Histogram, Burst Histogram
  // Layout: Three graphs stacked vertically, one below the other
  function displayKeystrokeFeatureHeatmap(keystroke1, keystroke2, x, y) {
    // Three features in heatmap: WPM, Avg KHT, Avg KIT
    const features = [
      {name: "WPM", key: "avgTypingSpeed", min: 20, max: 120, unit: "WPM"},
      {name: "Avg KHT", key: "avgKeyHoldTime", min: 50, max: 300, unit: "ms"},
      {name: "Avg KIT", key: "avgKeyInterval", min: 50, max: 500, unit: "ms"}
    ];
    
    // Vertical stacking layout: Each graph takes full width
    let labelWidth = DIMENSIONS.LABEL_WIDTH;
    let availableWidth = width - 2 * x - labelWidth;
    let graphSpacing = SPACING.GRAPH_BOTTOM_SPACING;
    
    // Graph dimensions - full width for better readability
    let graphWidth = availableWidth;
    let heatmapHeight = DIMENSIONS.HEATMAP_HEIGHT;
    let histogramHeight = DIMENSIONS.HISTOGRAM_HEIGHT;
    
    let currentY = y;
    let titleHeight = DIMENSIONS.TITLE_HEIGHT;
    
    // ========== GRAPH 1: Keystroke Feature Analysis (Heatmap) ==========
    let titleY = currentY;
    let graphY = currentY + titleHeight;
    
    // Draw title
    drawGraphTitle("Keystroke Feature Analysis", x + labelWidth + graphWidth/2, titleY);
    
    // Row labels for heatmap
    let rowLabelX = x + labelWidth - 12;
    let cellHeight = heatmapHeight / 2;
    let row1Y = graphY + cellHeight/2 + 6;
    let row2Y = graphY + cellHeight + cellHeight/2 + 6;
    drawRowLabels(rowLabelX, row1Y, row2Y);
    
    // Draw heatmap
    let heatmapX = x + labelWidth;
    drawGraphBox(heatmapX, graphY, graphWidth, heatmapHeight);
    
    let cellWidth = graphWidth / features.length;
    
    for (let i = 0; i < features.length; i++) {
      let feature = features[i];
      let value1 = keystroke1[feature.key] || 0;
      let value2 = keystroke2[feature.key] || 0;
      
      let cellX = heatmapX + i * cellWidth;
      
      // Normalize values to 0-1 range, clamping to ensure valid range
      // Handle edge cases where value might be outside min-max range
      // Normalize values to 0-1 range with precise floating point calculations
      // This ensures maximum sensitivity to small differences
      let range = feature.max - feature.min;
      let normalized1 = range > 0 ? (value1 - feature.min) / range : 0;
      let normalized2 = range > 0 ? (value2 - feature.min) / range : 0;
      
      // Clamp normalized values to [0, 1] range
      normalized1 = Math.max(0, Math.min(1, normalized1));
      normalized2 = Math.max(0, Math.min(1, normalized2));
      
      // Get colors based on normalized values (0 = blue/light, 1 = red/dark)
      let color1 = getHeatmapColor(normalized1);
      fill(color1);
      rect(cellX, graphY, cellWidth, cellHeight);
      
      let color2 = getHeatmapColor(normalized2);
      fill(color2);
      rect(cellX, graphY + cellHeight, cellWidth, cellHeight);
      
      fill(COLORS.TEXT_PRIMARY);
      textSize(12);
      textAlign(CENTER);
      textStyle(BOLD);
      // Move feature labels closer to heatmap to avoid overlap with legend
      text(feature.name.replace(" ", "\n"), cellX + cellWidth/2, graphY + heatmapHeight + 10);
      
      textSize(13);
      textAlign(CENTER);
      textStyle(BOLD);
      fill(255);
      stroke(0);
      strokeWeight(2);
      text(getFormattedValue(value1, feature.unit), cellX + cellWidth/2, graphY + cellHeight/2 + 4);
      text(getFormattedValue(value2, feature.unit), cellX + cellWidth/2, graphY + cellHeight + cellHeight/2 + 4);
      noStroke();
      textStyle(NORMAL);
    }
    
    // Draw color scale legend below heatmap with proper spacing
    // Position legend after feature labels with enough space
    let legendY = graphY + heatmapHeight + 35; // Increased from 30 to 35 for better spacing
    let legendWidth = graphWidth * 0.6;
    let legendHeight = 20;
    let legendX = heatmapX + (graphWidth - legendWidth) / 2;
    
    // Draw gradient bar
    for (let i = 0; i < legendWidth; i++) {
      let normalized = i / legendWidth;
      let legendColor = getHeatmapColor(normalized);
      stroke(legendColor);
      strokeWeight(2);
      line(legendX + i, legendY, legendX + i, legendY + legendHeight);
    }
    noStroke();
    
    // Add legend labels with better positioning
    fill(COLORS.TEXT_PRIMARY);
    textSize(10);
    textAlign(LEFT);
    text("Low", legendX - 30, legendY + legendHeight/2 + 3);
    textAlign(RIGHT);
    text("High", legendX + legendWidth + 30, legendY + legendHeight/2 + 3);
    textAlign(CENTER);
    
    // Update currentY to account for legend height and spacing
    // Legend ends at legendY + legendHeight, add extra spacing before next graph
    let legendBottom = legendY + legendHeight + 15; // 15px spacing after legend
    currentY = legendBottom + SPACING.GRAPH_BOTTOM_SPACING;
    
    // ========== GRAPH 2: Pause Histogram ==========
    titleY = currentY;
    graphY = currentY + titleHeight;
    drawGraphTitle("Pause Histogram", x + labelWidth + graphWidth/2, titleY);
    
    // No row labels needed for side-by-side bars - legend is shown in the histogram function
    drawPauseFrequencyHistogram(keystroke1, keystroke2, x + labelWidth, graphY, graphWidth, histogramHeight);
    
    currentY = graphY + histogramHeight + graphSpacing;
    
  // ========== GRAPH 3: Burst Histogram ==========
  titleY = currentY;
  graphY = currentY + titleHeight;
  drawGraphTitle("Burst Histogram", x + labelWidth + graphWidth/2, titleY);
  
  // No row labels needed for side-by-side bars - legend is shown in the histogram function
  drawBurstHistogram(keystroke1, keystroke2, x + labelWidth, graphY, graphWidth, histogramHeight);
    
    // Return the final Y position (graph end + label height) for button positioning
    return graphY + histogramHeight + 40; // 40px for label height below histogram
  }

  // Helper function to draw graph title
  function drawGraphTitle(title, x, y) {
    textStyle(BOLD);
    textSize(16);
    fill(COLORS.TEXT_PRIMARY);
    textAlign(CENTER);
    text(title, x, y + 5);
    textAlign(LEFT);
  }

  // Helper function to draw row labels
  function drawRowLabels(x, y1, y2) {
    textAlign(RIGHT);
    textSize(13);
    fill(45);
    textStyle(BOLD);
    text("Text 1:", x, y1);
    text("Text 2:", x, y2);
    textAlign(LEFT);
    textStyle(NORMAL);
  }

  // Helper function to draw graph box
  function drawGraphBox(x, y, w, h) {
    fill(255);
    stroke(COLORS.BOX_STROKE);
    strokeWeight(1.5);
    rect(x, y, w, h);
    noStroke();
  }

  // Helper function to draw histogram grid lines
  function drawHistogramGrid(x, y, width, height, padding, rowSpacing, barHeight) {
    stroke(COLORS.GRID_LINE);
    strokeWeight(0.5);
    for (let i = 0; i <= 4; i++) {
      let gridY = y + (barHeight * i / 4);
      line(x + padding, gridY, x + width - padding, gridY);
      let gridY2 = y + barHeight + rowSpacing + (barHeight * i / 4);
      line(x + padding, gridY2, x + width - padding, gridY2);
    }
    noStroke();
  }

  // Helper function to draw percentage label above bar
  function drawPercentageLabel(x, y, normalized) {
    fill(COLORS.TEXT_PRIMARY);
    textAlign(CENTER, BOTTOM);
    textSize(10);
    textStyle(BOLD);
    let percentage = (normalized * 100).toFixed(1);
    text(percentage + '%', x, y);
    textStyle(NORMAL);
  }

  // Helper function to draw histogram x-axis labels
  function drawHistogramXAxisLabels(labels, innerX, barSpacing, y, height, labelHeight) {
    fill(COLORS.TEXT_PRIMARY);
    textAlign(CENTER, TOP);
    textSize(9);
    textStyle(BOLD);
    for (let i = 0; i < labels.length; i++) {
      let labelX = innerX + i * barSpacing + barSpacing/2;
      text(labels[i], labelX, y + height - labelHeight + 8);
    }
    textStyle(NORMAL);
  }

  // Helper function to draw histogram bars (for Text 1 or Text 2)
  function drawHistogramBars(buckets, innerX, innerWidth, barSpacing, barWidthUsed, 
                            maxNormalized, barHeight, baseY, rowHeight, isText2) {
    for (let i = 0; i < buckets.length; i++) {
      let bucket = buckets[i];
      let barCenterX = innerX + (i + 0.5) * barSpacing;
      let barX = barCenterX - barWidthUsed / 2;
      
      // Clamp bar position to ensure it stays within inner bounds
      barX = Math.max(innerX + 2, Math.min(barX, innerX + innerWidth - barWidthUsed - 2));
      let maxBarX = innerX + innerWidth - barWidthUsed - 2;
      barX = Math.min(barX, maxBarX);
      
      let barH = maxNormalized > 0 ? (bucket.normalized / maxNormalized) * barHeight : 0;
      let barY = baseY + rowHeight - barH;
      
      // Color scheme: blue tones for Text 1, orange/red tones for Text 2
      let colorIntensity = map(i, 0, Math.max(buckets.length - 1, 1), 120, 220);
      if (isText2) {
        fill(colorIntensity, 130, 80); // Orange/red tones
      } else {
        fill(80, 140, colorIntensity); // Blue tones (pause) or green tones (burst)
      }
      
      // Final check: ensure bar width doesn't exceed available space
      let rightEdge = innerX + innerWidth - 2;
      let actualBarWidth = Math.min(barWidthUsed, rightEdge - barX);
      rect(barX, barY, actualBarWidth, barH);
      
      // Draw percentage label above bar
      if (bucket.normalized > 0) {
        drawPercentageLabel(barCenterX, barY - 3, bucket.normalized);
      }
    }
  }

  function drawPauseFrequencyHistogram(keystroke1, keystroke2, x, y, width, height) {
    // Use pause histogram from JSON if available
    let buckets1 = keystroke1.pauseHistogram || [];
    let buckets2 = keystroke2.pauseHistogram || [];
    
    // Convert JSON histogram format to bucket format
    let convertHistogramToBuckets = (histogram) => {
      return histogram.map(bin => {
        let rangeMatch = bin.BinRange.match(/(\d+)-(\d+)/);
        let label = bin.BinRange;
        let min = rangeMatch ? parseInt(rangeMatch[1]) : 0;
        let max = rangeMatch ? parseInt(rangeMatch[2]) : 1000;
        return {
          label: label,
          min: min,
          max: max,
          count: bin.Proportion * 100, // Convert proportion to count for display
          normalized: bin.Proportion
        };
      });
    };
    
    let normalizedBuckets1 = convertHistogramToBuckets(buckets1);
    let normalizedBuckets2 = convertHistogramToBuckets(buckets2);
    
    // Ensure both have the same buckets for alignment
    let allBuckets = new Map();
    normalizedBuckets1.forEach(b => allBuckets.set(b.label, b));
    normalizedBuckets2.forEach(b => allBuckets.set(b.label, b));
    let sortedLabels = Array.from(allBuckets.keys()).sort((a, b) => {
      let matchA = a.match(/(\d+)-(\d+)/);
      let matchB = b.match(/(\d+)-(\d+)/);
      if (matchA && matchB) {
        return parseInt(matchA[1]) - parseInt(matchB[1]);
      }
      return a.localeCompare(b);
    });
    
    // Create aligned bucket arrays
    let alignedBuckets1 = sortedLabels.map(label => {
      let found = normalizedBuckets1.find(b => b.label === label);
      return found || { label: label, normalized: 0, min: 0, max: 0 };
    });
    let alignedBuckets2 = sortedLabels.map(label => {
      let found = normalizedBuckets2.find(b => b.label === label);
      return found || { label: label, normalized: 0, min: 0, max: 0 };
    });
    
    let maxNormalized1 = Math.max(...alignedBuckets1.map(b => b.normalized), 0);
    let maxNormalized2 = Math.max(...alignedBuckets2.map(b => b.normalized), 0);
    let maxNormalized = Math.max(maxNormalized1, maxNormalized2, 0.01);
    
    // UX-optimized spacing and dimensions for side-by-side bars
    let padding = 20;
    let labelHeight = 45; // Space for x-axis labels (increased for better readability)
    let percentageLabelHeight = 20; // Space for percentage labels above bars
    let legendHeight = 0; // Legend moved to top, no space needed at bottom
    
    let innerWidth = width - (2 * padding);
    let innerX = x + padding;
    let numBins = Math.max(sortedLabels.length, 1);
    
    // Calculate spacing: each bin gets space for two bars side by side with generous gaps
    let gapBetweenBins = 15; // Increased gap between different bins for better separation
    let gapBetweenBars = 8; // Increased gap between Text 1 and Text 2 bars within same bin
    let totalGaps = (numBins - 1) * gapBetweenBins; // Total space used by gaps between bins
    let availableWidth = innerWidth - totalGaps;
    let barWidth = (availableWidth / numBins - gapBetweenBars) / 2; // Each bar width
    
    // Ensure minimum bar width for readability
    let minBarWidth = 28;
    if (barWidth < minBarWidth) {
      barWidth = minBarWidth;
      gapBetweenBars = Math.max(6, (availableWidth / numBins) - (barWidth * 2));
    }
    
    // Full height for bars (single row, side by side)
    let barHeight = height - labelHeight - percentageLabelHeight - legendHeight - padding - 35; // Extra space for top legend
    let barBaseY = y + padding + 35; // Start below legend
    
    // Consistent colors for Text 1 and Text 2 (same across all bins)
    let text1Color = color(70, 130, 200);   // Blue for Text 1
    let text2Color = color(220, 100, 80);   // Orange/red for Text 2
    
    // Draw background box first
    drawGraphBox(x, y, width, height);
    
    // Draw legend at the top right (more friendly and visible position) - AFTER background box
    // Position it clearly visible, not too close to edges
    let legendY = y + 15;
    let legendX = x + width - 220; // Top right area, ensure it's within bounds
    
    // Draw a subtle background for legend to make it stand out
    fill(255, 255, 255, 240); // Semi-transparent white background
    noStroke();
    rect(legendX - 10, legendY - 5, 210, 32, 6);
    
    // Text 1 legend (blue) - with friendly styling and better visibility
    fill(text1Color);
    noStroke();
    rect(legendX, legendY, 22, 22, 4); // Larger with rounded corners
    fill(COLORS.TEXT_PRIMARY);
    textAlign(LEFT, CENTER);
    textSize(14);
    textStyle(BOLD);
    text('Text 1', legendX + 30, legendY + 11);
    
    // Text 2 legend (orange) - with friendly styling and better visibility
    fill(text2Color);
    noStroke();
    rect(legendX + 100, legendY, 22, 22, 4); // Larger with rounded corners
    fill(COLORS.TEXT_PRIMARY);
    text('Text 2', legendX + 130, legendY + 11);
    
    textAlign(LEFT, TOP);
    textStyle(NORMAL);
    noStroke();
    
    // Draw grid lines
    stroke(COLORS.GRID_LINE);
    strokeWeight(0.5);
    for (let i = 0; i <= 4; i++) {
      let gridY = barBaseY + (barHeight * i / 4);
      line(x + padding, gridY, x + width - padding, gridY);
    }
    noStroke();
    
    // Draw side-by-side bars for each bin and track bin centers for labels
    let currentX = innerX;
    let binCenters = []; // Store center X position and label for each bin
    
    for (let i = 0; i < alignedBuckets1.length; i++) {
      // Calculate center of this bin pair (always calculate, even if empty)
      let binCenterX = currentX + barWidth + gapBetweenBars / 2;
      let hasData1 = alignedBuckets1[i].normalized > 0;
      let hasData2 = alignedBuckets2[i].normalized > 0;
      let hasAnyData = hasData1 || hasData2;
      
      // Text 1 bar (left side, consistent blue)
      let bar1X = currentX;
      let bar1H = maxNormalized > 0 ? (alignedBuckets1[i].normalized / maxNormalized) * barHeight : 0;
      let bar1Y = barBaseY + barHeight - bar1H;
      
      if (hasData1) {
        // Draw solid bar with data
        fill(text1Color);
        noStroke();
        rect(bar1X, bar1Y, barWidth, bar1H);
        
        // Percentage label for Text 1
        drawPercentageLabel(bar1X + barWidth / 2, bar1Y - 3, alignedBuckets1[i].normalized);
      } else if (hasData2) {
        // Show subtle placeholder for empty Text 1 when Text 2 has data
        // This maintains visual structure and shows "no data" clearly
        stroke(COLORS.GRID_LINE);
        strokeWeight(1);
        noFill();
        rect(bar1X, barBaseY + barHeight - 2, barWidth, 2); // Thin line at base
        noStroke();
      }
      
      // Text 2 bar (right side, consistent orange/red)
      let bar2X = currentX + barWidth + gapBetweenBars;
      let bar2H = maxNormalized > 0 ? (alignedBuckets2[i].normalized / maxNormalized) * barHeight : 0;
      let bar2Y = barBaseY + barHeight - bar2H;
      
      if (hasData2) {
        // Draw solid bar with data
        fill(text2Color);
        noStroke();
        rect(bar2X, bar2Y, barWidth, bar2H);
        
        // Percentage label for Text 2
        drawPercentageLabel(bar2X + barWidth / 2, bar2Y - 3, alignedBuckets2[i].normalized);
      } else if (hasData1) {
        // Show subtle placeholder for empty Text 2 when Text 1 has data
        stroke(COLORS.GRID_LINE);
        strokeWeight(1);
        noFill();
        rect(bar2X, barBaseY + barHeight - 2, barWidth, 2); // Thin line at base
        noStroke();
      }
      
      // If both are empty, show a subtle indicator that this bin exists but has no data
      if (!hasAnyData) {
        // Draw a very subtle dashed line or dot to indicate empty bin
        stroke(COLORS.GRID_LINE);
        strokeWeight(0.5);
        noFill();
        // Draw a small dot or dash at the center bottom
        let emptyIndicatorY = barBaseY + barHeight - 3;
        line(binCenterX - 3, emptyIndicatorY, binCenterX + 3, emptyIndicatorY);
        noStroke();
      }
      
      // Store bin center and label for ALL bins (including empty ones)
      binCenters.push({
        x: binCenterX,
        label: sortedLabels[i],
        hasData: hasAnyData
      });
      
      // Move to next bin position
      currentX += (barWidth * 2) + gapBetweenBars + gapBetweenBins;
    }
    
    // Draw x-axis labels for all bins, centered under each bin pair with friendly styling
    textAlign(CENTER, TOP);
    textSize(10);
    textStyle(NORMAL);
    
    for (let binInfo of binCenters) {
      // Show label for all bins, but use lighter color for empty bins
      if (binInfo.hasData) {
        fill(COLORS.TEXT_SECONDARY);
      } else {
        fill(COLORS.TEXT_QUATERNARY); // Lighter color for empty bins
      }
      
      // Draw label with better spacing
      text(binInfo.label, binInfo.x, y + height - labelHeight + 10);
      
      // Add subtle separator line above label for better visual separation (optional)
      if (binInfo.hasData) {
        stroke(COLORS.GRID_LINE);
        strokeWeight(0.5);
        line(binInfo.x - (barWidth + gapBetweenBars / 2), y + height - labelHeight + 5,
            binInfo.x + (barWidth + gapBetweenBars / 2), y + height - labelHeight + 5);
        noStroke();
      }
    }
    
    fill(COLORS.TEXT_PRIMARY); // Reset to default
    textAlign(LEFT, TOP);
    textStyle(NORMAL);
  }

function drawBurstHistogram(keystroke1, keystroke2, x, y, width, height) {
  // Use burst histogram from JSON if available
  let bursts1 = keystroke1.burstHistogram || [];
  let bursts2 = keystroke2.burstHistogram || [];
  
  // Convert JSON histogram format to bucket format
  let convertBurstHistogramToBuckets = (histogram) => {
    return histogram.map(bin => {
      return {
        label: bin.BurstLength_Keys.toString() + ' keys',
        burstLength: bin.BurstLength_Keys,
        count: bin.Proportion * 100, // Convert proportion to count for display
        normalized: bin.Proportion
      };
    });
  };
  
  let normalizedBuckets1 = convertBurstHistogramToBuckets(bursts1);
  let normalizedBuckets2 = convertBurstHistogramToBuckets(bursts2);
  
  // Get all unique burst lengths to align bars properly
  let allBurstLengths = new Set();
  normalizedBuckets1.forEach(b => allBurstLengths.add(b.burstLength));
  normalizedBuckets2.forEach(b => allBurstLengths.add(b.burstLength));
  let sortedBurstLengths = Array.from(allBurstLengths).sort((a, b) => a - b);
  
  // Create aligned bucket arrays (fill gaps with zero values)
  let alignedBuckets1 = sortedBurstLengths.map(burstLength => {
    let found = normalizedBuckets1.find(b => b.burstLength === burstLength);
    return found || { 
      label: burstLength.toString() + ' keys', 
      burstLength: burstLength, 
      normalized: 0 
    };
  });
  let alignedBuckets2 = sortedBurstLengths.map(burstLength => {
    let found = normalizedBuckets2.find(b => b.burstLength === burstLength);
    return found || { 
      label: burstLength.toString() + ' keys', 
      burstLength: burstLength, 
      normalized: 0 
    };
  });
  
  let maxNormalized1 = Math.max(...alignedBuckets1.map(b => b.normalized), 0);
  let maxNormalized2 = Math.max(...alignedBuckets2.map(b => b.normalized), 0);
  let maxNormalized = Math.max(maxNormalized1, maxNormalized2, 0.01);
  
  // UX-optimized spacing and dimensions for side-by-side bars (same as pause histogram)
  // Responsive padding based on screen size
  let isMobile = width < DIMENSIONS.MOBILE_BREAKPOINT;
  let padding = isMobile ? 15 : 20;
  let labelHeight = 45; // Space for x-axis labels (increased for better readability)
  let percentageLabelHeight = 20; // Space for percentage labels above bars
  let legendHeight = 0; // Legend moved to top, no space needed at bottom
  
  let innerWidth = width - (2 * padding);
  let innerX = x + padding;
  let numBins = Math.max(sortedBurstLengths.length, 1);
  
  // Responsive spacing: reduce gaps on smaller screens to prevent overflow
  let gapBetweenBins = isMobile ? 8 : 15; // Smaller gap on mobile
  let gapBetweenBars = isMobile ? 4 : 8; // Smaller gap between bars on mobile
  let totalGaps = (numBins - 1) * gapBetweenBins; // Total space used by gaps between bins
  let availableWidth = innerWidth - totalGaps;
  
  // Calculate bar width ensuring bars fit within container
  let barWidth = (availableWidth / numBins - gapBetweenBars) / 2; // Each bar width
  
  // Responsive minimum bar width - smaller on mobile to prevent overflow
  let minBarWidth = isMobile ? 12 : 28;
  
  // If bars would be too narrow, recalculate to fit within container
  if (barWidth < minBarWidth) {
    // Recalculate with minimum bar width, ensuring total width doesn't exceed container
    let maxTotalBarWidth = (barWidth * 2 + gapBetweenBars) * numBins + totalGaps;
    if (maxTotalBarWidth > innerWidth) {
      // Reduce gaps further if needed
      gapBetweenBins = Math.max(4, gapBetweenBins - 2);
      gapBetweenBars = Math.max(2, gapBetweenBars - 1);
      totalGaps = (numBins - 1) * gapBetweenBins;
      availableWidth = innerWidth - totalGaps;
    }
    barWidth = Math.max(minBarWidth, (availableWidth / numBins - gapBetweenBars) / 2);
    
    // Final check: ensure bars don't overflow
    let totalWidthNeeded = (barWidth * 2 + gapBetweenBars) * numBins + totalGaps;
    if (totalWidthNeeded > innerWidth) {
      // Scale down bar width to fit
      let scaleFactor = innerWidth / totalWidthNeeded;
      barWidth = barWidth * scaleFactor;
      gapBetweenBars = gapBetweenBars * scaleFactor;
      gapBetweenBins = gapBetweenBins * scaleFactor;
    }
  }
  
  // Full height for bars (single row, side by side)
  let barHeight = height - labelHeight - percentageLabelHeight - legendHeight - padding - 35; // Extra space for top legend
  let barBaseY = y + padding + 35; // Start below legend
  
  // Consistent colors for Text 1 and Text 2 (same across all bins)
  // Using green for Text 1 burst (to differentiate from pause histogram) and orange for Text 2
  let text1Color = color(80, 180, 120);   // Green for Text 1 burst histogram
  let text2Color = color(220, 100, 80);   // Orange/red for Text 2
  
  // Draw background box first
  drawGraphBox(x, y, width, height);
  
  // Draw legend at the top right (same as pause histogram)
  // Responsive legend positioning for mobile
  let legendY = y + 15;
  let legendWidth_total = isMobile ? 160 : 210;
  let legendX = x + width - legendWidth_total - 10; // Top right area, ensure it's within bounds
  
  // Ensure legend doesn't go off screen on very small screens
  if (legendX < x + padding) {
    legendX = x + padding;
  }
  
  // Draw a subtle background for legend to make it stand out
  fill(255, 255, 255, 240); // Semi-transparent white background
  noStroke();
  rect(legendX - 10, legendY - 5, legendWidth_total, 32, 6);
  
  // Text 1 legend (green) - with friendly styling and better visibility
  fill(text1Color);
  noStroke();
  let legendBoxSize = isMobile ? 18 : 22;
  rect(legendX, legendY, legendBoxSize, legendBoxSize, 4); // Responsive size
  fill(COLORS.TEXT_PRIMARY);
  textAlign(LEFT, CENTER);
  textSize(isMobile ? 12 : 14);
  textStyle(BOLD);
  text('Text 1', legendX + legendBoxSize + 8, legendY + legendBoxSize/2);
  
  // Text 2 legend (orange) - with friendly styling and better visibility
  fill(text2Color);
  noStroke();
  let text2LegendX = isMobile ? legendX + 80 : legendX + 100;
  rect(text2LegendX, legendY, legendBoxSize, legendBoxSize, 4); // Responsive size
  fill(COLORS.TEXT_PRIMARY);
  text('Text 2', text2LegendX + legendBoxSize + 8, legendY + legendBoxSize/2);
  
  textAlign(LEFT, TOP);
  textStyle(NORMAL);
  noStroke();
  
  // Draw grid lines
  stroke(COLORS.GRID_LINE);
  strokeWeight(0.5);
  for (let i = 0; i <= 4; i++) {
    let gridY = barBaseY + (barHeight * i / 4);
    line(x + padding, gridY, x + width - padding, gridY);
  }
  noStroke();
  
  // Draw side-by-side bars for each bin and track bin centers for labels
  let currentX = innerX;
  let binCenters = []; // Store center X position and label for each bin
  
  for (let i = 0; i < alignedBuckets1.length; i++) {
    // Calculate center of this bin pair (always calculate, even if empty)
    let binCenterX = currentX + barWidth + gapBetweenBars / 2;
    let hasData1 = alignedBuckets1[i].normalized > 0;
    let hasData2 = alignedBuckets2[i].normalized > 0;
    let hasAnyData = hasData1 || hasData2;
    
    // Text 1 bar (left side, consistent green)
    let bar1X = currentX;
    let bar1H = maxNormalized > 0 ? (alignedBuckets1[i].normalized / maxNormalized) * barHeight : 0;
    let bar1Y = barBaseY + barHeight - bar1H;
    
    if (hasData1) {
      // Draw solid bar with data
      fill(text1Color);
      noStroke();
      rect(bar1X, bar1Y, barWidth, bar1H);
      
      // Percentage label for Text 1
      drawPercentageLabel(bar1X + barWidth / 2, bar1Y - 3, alignedBuckets1[i].normalized);
    } else if (hasData2) {
      // Show subtle placeholder for empty Text 1 when Text 2 has data
      stroke(COLORS.GRID_LINE);
      strokeWeight(1);
      noFill();
      rect(bar1X, barBaseY + barHeight - 2, barWidth, 2); // Thin line at base
      noStroke();
    }
    
    // Text 2 bar (right side, consistent orange/red)
    let bar2X = currentX + barWidth + gapBetweenBars;
    let bar2H = maxNormalized > 0 ? (alignedBuckets2[i].normalized / maxNormalized) * barHeight : 0;
    let bar2Y = barBaseY + barHeight - bar2H;
    
    if (hasData2) {
      // Draw solid bar with data
      fill(text2Color);
      noStroke();
      rect(bar2X, bar2Y, barWidth, bar2H);
      
      // Percentage label for Text 2
      drawPercentageLabel(bar2X + barWidth / 2, bar2Y - 3, alignedBuckets2[i].normalized);
    } else if (hasData1) {
      // Show subtle placeholder for empty Text 2 when Text 1 has data
      stroke(COLORS.GRID_LINE);
      strokeWeight(1);
      noFill();
      rect(bar2X, barBaseY + barHeight - 2, barWidth, 2); // Thin line at base
      noStroke();
    }
    
    // If both are empty, show a subtle indicator that this bin exists but has no data
    if (!hasAnyData) {
      // Draw a very subtle dashed line or dot to indicate empty bin
      stroke(COLORS.GRID_LINE);
      strokeWeight(0.5);
      noFill();
      // Draw a small dot or dash at the center bottom
      let emptyIndicatorY = barBaseY + barHeight - 3;
      line(binCenterX - 3, emptyIndicatorY, binCenterX + 3, emptyIndicatorY);
      noStroke();
    }
    
    // Store bin center and label for ALL bins (including empty ones)
    binCenters.push({
      x: binCenterX,
      label: alignedBuckets1[i].label,
      hasData: hasAnyData
    });
    
    // Move to next bin position
    currentX += (barWidth * 2) + gapBetweenBars + gapBetweenBins;
    
    // Safety check: ensure we don't exceed container width
    if (currentX + barWidth > x + width - padding) {
      console.warn('Burst histogram bars would overflow container, stopping at bin', i);
      break;
    }
  }
  
  // Draw x-axis labels for all bins, centered under each bin pair with friendly styling
  textAlign(CENTER, TOP);
  textSize(10);
  textStyle(NORMAL);
  
  for (let binInfo of binCenters) {
    // Show label for all bins, but use lighter color for empty bins
    if (binInfo.hasData) {
      fill(COLORS.TEXT_SECONDARY);
    } else {
      fill(COLORS.TEXT_QUATERNARY); // Lighter color for empty bins
    }
    
    // Draw label with better spacing
    text(binInfo.label, binInfo.x, y + height - labelHeight + 10);
    
    // Add subtle separator line above label for better visual separation
    if (binInfo.hasData) {
      stroke(COLORS.GRID_LINE);
      strokeWeight(0.5);
      line(binInfo.x - (barWidth + gapBetweenBars / 2), y + height - labelHeight + 5,
          binInfo.x + (barWidth + gapBetweenBars / 2), y + height - labelHeight + 5);
      noStroke();
    }
  }
  
  fill(COLORS.TEXT_PRIMARY); // Reset to default
  textAlign(LEFT, TOP);
  textStyle(NORMAL);
}

  function getHeatmapColor(normalizedValue) {
    // Clamp normalized value between 0 and 1
    normalizedValue = Math.max(0, Math.min(1, normalizedValue));
    
    // Use chroma.js library for professional heatmap color scales
    // Check if chroma.js is available, fallback to custom implementation if not
    if (typeof chroma !== 'undefined') {
      // Use chroma.js color scale: Blue (low) → Cyan → Green → Yellow → Red (high)
      // Create a perceptually uniform color scale using chroma.js
      let colorScale = chroma.scale(['#0066ff', '#00ccff', '#00ff00', '#ffff00', '#ff9900', '#ff0000'])
        .domain([0, 1])
        .mode('rgb');
      
      // Get color from chroma.js and convert to p5.js color
      let chromaColor = colorScale(normalizedValue);
      let rgb = chromaColor.rgb();
      
      // Log once on first call to confirm chroma.js is being used
      if (!window.chromaJsConfirmed) {
        console.log('✅ Using chroma.js library for heatmap colors');
        window.chromaJsConfirmed = true;
      }
      
      return color(rgb[0], rgb[1], rgb[2]);
    } else {
      // Fallback: Use simple RGB interpolation if chroma.js is not loaded
      console.warn('⚠️ chroma.js not loaded, using fallback color function');
      console.warn('Please add: <script src="https://cdn.jsdelivr.net/npm/chroma-js@2.4.2/chroma.min.js"></script> to your HTML');
      let r, g, b;
      
      if (normalizedValue < 0.2) {
        // Blue to Cyan
        let t = normalizedValue / 0.2;
        r = 0;
        g = Math.floor(255 * t);
        b = 255;
      } else if (normalizedValue < 0.4) {
        // Cyan to Green
        let t = (normalizedValue - 0.2) / 0.2;
        r = 0;
        g = 255;
        b = Math.floor(255 * (1 - t));
      } else if (normalizedValue < 0.6) {
        // Green to Yellow
        let t = (normalizedValue - 0.4) / 0.2;
        r = Math.floor(255 * t);
        g = 255;
        b = 0;
      } else if (normalizedValue < 0.8) {
        // Yellow to Orange
        let t = (normalizedValue - 0.6) / 0.2;
        r = 255;
        g = Math.floor(255 * (1 - t * 0.5));
        b = 0;
      } else {
        // Orange to Red
        let t = (normalizedValue - 0.8) / 0.2;
        r = 255;
        g = Math.floor(255 * 0.5 * (1 - t));
        b = 0;
      }
      
      return color(r, g, b);
    }
  }

  function getFormattedValue(value, unit) {
    if (unit === "ms") {
      return Math.round(value) + "ms";
    } else if (unit === "WPM") {
      return Math.round(value) + "WPM";
    } else if (unit === "/min") {
      return value.toFixed(1) + "/min";
    } else if (unit === "%") {
      return (value * 100).toFixed(1) + "%";
    } else {
      return Math.round(value);
    }
  }

  function recordResponse(responseType) {
    if (currentPair < textPairs.length) {
      let pair = textPairs[currentPair];
      // Store response as object with all necessary data for completion page
      userResponses[currentPair] = {
        displayOrder: currentPair,
        pairId: pair.id || `pair_${currentPair}`,
        actualType: pair.actualType,
        userResponse: responseType,
        timestamp: new Date().toISOString(),
        difficulty: pair.difficulty || "MEDIUM",
        text1KeystrokeData: pair.text1.keystrokeData,
        text2KeystrokeData: pair.text2.keystrokeData
      };
      updateButtonHighlights();
    }
  }

  function hasResponseForCurrentPair() {
    return userResponses[currentPair] !== undefined && userResponses[currentPair] !== null;
  }

  function updateButtonHighlights() {
    buttons.forEach((btn, index) => {
      if (!btn || !btn.elt) return; // Skip if button doesn't exist
      
      let response = userResponses[currentPair];
      let isSelected = false;
      if (response) {
        if (index === 0 && response.userResponse === 'same_user') {
          isSelected = true;
        } else if (index === 1 && response.userResponse === 'different_users') {
          isSelected = true;
        }
      }
      
      // Ensure button is always enabled and clickable
      btn.elt.style.pointerEvents = 'auto';
      btn.elt.style.cursor = 'pointer';
      btn.elt.removeAttribute('disabled');
      
      if (isSelected) {
        btn.addClass('selected');
        btn.style('background-color', COLORS.SELECTED_BUTTON);
        btn.style('color', 'white');
        btn.style('border', '2px solid ' + COLORS.SELECTED_BUTTON_BORDER);
        btn.style('font-weight', 'bold');
        btn.style('cursor', 'pointer');
      } else {
        btn.removeClass('selected');
        btn.style('background-color', COLORS.DEFAULT_BUTTON);
        btn.style('color', 'white');
        btn.style('border', 'none');
        btn.style('font-weight', '500');
        btn.style('cursor', 'pointer');
      }
    });
    
    // Update Next button state based on whether there's a response
    updateNextButtonState();
    // Update Previous button state (disable on first pair)
    updatePreviousButtonState();
  }

  function updatePreviousButtonState() {
    if (navButtons.length >= 1) {
      let prevBtn = navButtons[0]; // Previous button is the first navigation button
      
      // Always enable Previous button - it can go back to intro page from first pair
      // or to previous pair if not on first pair
      prevBtn.style('background-color', '#ffffff');
      prevBtn.style('color', '#333');
      prevBtn.style('border', '2px solid #dee2e6');
      prevBtn.style('cursor', 'pointer');
      prevBtn.style('opacity', '1');
    }
  }

  function updateNextButtonState() {
    if (navButtons.length >= 2) {
      let nextBtn = navButtons[1]; // Next button is the second navigation button
      let hasResponse = hasResponseForCurrentPair();
      
      if (hasResponse) {
        nextBtn.style('background-color', COLORS.NAV_BUTTON_ENABLED);
        nextBtn.style('color', 'white');
        nextBtn.style('border', '2px solid ' + COLORS.NAV_BUTTON_ENABLED_HOVER);
        nextBtn.style('cursor', 'pointer');
        nextBtn.style('opacity', '1');
        if (nextBtn.elt) {
          nextBtn.elt.removeAttribute('disabled');
        }
      } else {
        nextBtn.style('background-color', COLORS.NAV_BUTTON_DISABLED);
        nextBtn.style('color', '#666666');
        nextBtn.style('border', '2px solid #999999');
        nextBtn.style('cursor', 'not-allowed');
        nextBtn.style('opacity', '0.6');
        if (nextBtn.elt) {
          nextBtn.elt.removeAttribute('disabled');
        }
      }
    }
  }

  function createUI() {
    // Remove existing buttons first to avoid duplicates
    buttons.forEach(btn => {
      if (btn && btn.remove) {
        btn.remove();
      }
    });
    buttons = [];
    
    let isMobile = isMobileDevice();
    // Use dynamic content height from last graph position, or fallback to calculated height
    let contentHeight = window.lastGraphEndY || (120 + 40 + 180 + 50 + 30 + 220 + 50 + 30 + 280 + 40 + 30 + 280 + 40);
    let bottomMargin = isMobile ? SPACING.BOTTOM_MARGIN_MOBILE : SPACING.BOTTOM_MARGIN_DESKTOP;
    let buttonY = contentHeight + bottomMargin + 20; // Extra spacing to prevent overlap
    let buttonWidth = 200;
    let spacing = SPACING.BUTTON_SPACING * 2;
    let totalWidth = (2 * buttonWidth) + spacing;
    let startX = (width - totalWidth) / 2;
    
    // Create "Same User" button with proper event handlers
    let sameBtn = createButton('Same User');
    sameBtn.position(startX, buttonY);
    sameBtn.size(buttonWidth, 50);
    sameBtn.style('font-size', '16px');
    sameBtn.style('background-color', COLORS.DEFAULT_BUTTON);
    sameBtn.style('color', 'white');
    sameBtn.style('border', 'none');
    sameBtn.style('border-radius', '8px');
    sameBtn.style('box-shadow', '0 2px 8px rgba(0,0,0,0.15)');
    sameBtn.style('font-weight', '500');
    sameBtn.style('position', 'absolute'); // Use absolute positioning
    sameBtn.style('z-index', '10000'); // Higher z-index
    sameBtn.style('cursor', 'pointer');
    sameBtn.style('pointer-events', 'auto');
    sameBtn.style('user-select', 'none');
    sameBtn.style('display', 'block');
    sameBtn.style('visibility', 'visible');
    
    // Ensure button element is clickable
    if (sameBtn.elt) {
      sameBtn.elt.style.pointerEvents = 'auto';
      sameBtn.elt.style.cursor = 'pointer';
      sameBtn.elt.style.zIndex = '10000';
      
      // Add click event listener directly to DOM element
      sameBtn.elt.addEventListener('click', function(e) {
        e.preventDefault();
        e.stopPropagation();
        console.log('Same User button clicked (DOM)');
        recordResponse('same_user');
        updateButtonHighlights();
        return false;
      }, true); // Use capture phase
      
      // Also add mousedown for better compatibility
      sameBtn.elt.addEventListener('mousedown', function(e) {
        e.preventDefault();
        e.stopPropagation();
        console.log('Same User button mousedown');
        recordResponse('same_user');
        updateButtonHighlights();
        return false;
      }, true);
    }
    
    // Use p5.js mousePressed as backup
    sameBtn.mousePressed(() => {
      console.log('Same User button clicked (p5)');
      recordResponse('same_user');
      updateButtonHighlights();
    });
    
    sameBtn.class('response-btn');
    buttons.push(sameBtn);
    
    // Create "Different Users" button with proper event handlers
    let differentBtn = createButton('Different Users');
    differentBtn.position(startX + buttonWidth + spacing, buttonY);
    differentBtn.size(buttonWidth, DIMENSIONS.RESPONSE_BUTTON_HEIGHT);
    differentBtn.style('font-size', '16px');
    differentBtn.style('background-color', COLORS.DEFAULT_BUTTON);
    differentBtn.style('color', 'white');
    differentBtn.style('border', 'none');
    differentBtn.style('border-radius', '8px');
    differentBtn.style('box-shadow', '0 2px 8px rgba(0,0,0,0.15)');
    differentBtn.style('font-weight', '500');
    differentBtn.style('position', 'absolute'); // Use absolute positioning
    differentBtn.style('z-index', '10000'); // Higher z-index
    differentBtn.style('cursor', 'pointer');
    differentBtn.style('pointer-events', 'auto');
    differentBtn.style('user-select', 'none');
    differentBtn.style('display', 'block');
    differentBtn.style('visibility', 'visible');
    
    // Ensure button element is clickable
    if (differentBtn.elt) {
      differentBtn.elt.style.pointerEvents = 'auto';
      differentBtn.elt.style.cursor = 'pointer';
      differentBtn.elt.style.zIndex = '10000';
      
      // Add click event listener directly to DOM element
      differentBtn.elt.addEventListener('click', function(e) {
        e.preventDefault();
        e.stopPropagation();
        console.log('Different Users button clicked (DOM)');
        recordResponse('different_users');
        updateButtonHighlights();
        return false;
      }, true); // Use capture phase
      
      // Also add mousedown for better compatibility
      differentBtn.elt.addEventListener('mousedown', function(e) {
        e.preventDefault();
        e.stopPropagation();
        console.log('Different Users button mousedown');
        recordResponse('different_users');
        updateButtonHighlights();
        return false;
      }, true);
    }
    
    // Use p5.js mousePressed as backup
    differentBtn.mousePressed(() => {
      console.log('Different Users button clicked (p5)');
      recordResponse('different_users');
      updateButtonHighlights();
    });
    
    differentBtn.class('response-btn');
    buttons.push(differentBtn);
    
    // Add hover event listeners using DOM element for better compatibility
    let sameBtnEl = sameBtn.elt;
    sameBtnEl.addEventListener('mouseenter', () => {
      if (!sameBtn.hasClass('selected')) {
        sameBtn.style('background-color', COLORS.DEFAULT_BUTTON_HOVER);
        sameBtn.style('transform', 'translateY(-2px)');
        sameBtn.style('box-shadow', '0 4px 12px rgba(0,0,0,0.25)');
      } else {
        sameBtn.style('background-color', COLORS.SELECTED_BUTTON_HOVER);
      }
    });
    sameBtnEl.addEventListener('mouseleave', () => {
      if (!sameBtn.hasClass('selected')) {
        sameBtn.style('background-color', COLORS.DEFAULT_BUTTON);
        sameBtn.style('transform', 'translateY(0)');
        sameBtn.style('box-shadow', '0 2px 8px rgba(0,0,0,0.15)');
      } else {
        sameBtn.style('background-color', COLORS.SELECTED_BUTTON);
      }
    });
    
    let differentBtnEl = differentBtn.elt;
    differentBtnEl.addEventListener('mouseenter', () => {
      if (!differentBtn.hasClass('selected')) {
        differentBtn.style('background-color', COLORS.DEFAULT_BUTTON_HOVER);
        differentBtn.style('transform', 'translateY(-2px)');
        differentBtn.style('box-shadow', '0 4px 12px rgba(0,0,0,0.25)');
      } else {
        differentBtn.style('background-color', COLORS.SELECTED_BUTTON_HOVER);
      }
    });
    differentBtnEl.addEventListener('mouseleave', () => {
      if (!differentBtn.hasClass('selected')) {
        differentBtn.style('background-color', COLORS.DEFAULT_BUTTON);
        differentBtn.style('transform', 'translateY(0)');
        differentBtn.style('box-shadow', '0 2px 8px rgba(0,0,0,0.15)');
      } else {
        differentBtn.style('background-color', COLORS.SELECTED_BUTTON);
      }
    });
    
    let style = document.createElement('style');
    style.textContent = `
      .response-btn {
        transition: all 0.3s ease;
        cursor: pointer;
      }
      .response-btn:hover:not(.selected) {
        background-color: #5A6268 !important;
        transform: translateY(-2px) !important;
        box-shadow: 0 4px 12px rgba(0,0,0,0.25) !important;
      }
      .response-btn.selected {
        background-color: #28A745 !important;
        color: white !important;
        font-weight: bold;
        border: 2px solid #1E7E34 !important;
        box-shadow: 0 4px 12px rgba(40, 167, 69, 0.4) !important;
        transform: scale(1.05);
        animation: pulse 1.5s infinite;
      }
      .response-btn.selected:hover {
        background-color: #218838 !important;
      }
      @keyframes pulse {
        0% { transform: scale(1.05); }
        50% { transform: scale(1.08); }
        100% { transform: scale(1.05); }
      }
      .response-btn:active {
        transform: scale(0.98);
      }
    `;
    document.head.appendChild(style);
  }

  function createNavigationUI() {
    navButtons.forEach(btn => btn.remove());
    navButtons = [];
    
    let isMobile = isMobileDevice();
    let navButtonWidth = isMobile ? DIMENSIONS.NAV_BUTTON_WIDTH_MOBILE : DIMENSIONS.NAV_BUTTON_WIDTH_DESKTOP;
    let navSpacing = isMobile ? SPACING.BUTTON_SPACING : SPACING.BUTTON_SPACING + 5;
    let buttonHeight = isMobile ? DIMENSIONS.NAV_BUTTON_HEIGHT_MOBILE : DIMENSIONS.NAV_BUTTON_HEIGHT_DESKTOP;
    let fontSize = isMobile ? '13px' : '14px';
    
    // Use dynamic content height from last graph position, or fallback to calculated height
    let contentHeight = window.lastGraphEndY || (120 + 40 + 180 + 50 + 30 + 220 + 50 + 30 + 280 + 40 + 30 + 280 + 40);
    let bottomMargin = isMobile ? SPACING.BOTTOM_MARGIN_MOBILE : SPACING.BOTTOM_MARGIN_DESKTOP;
    let responseButtonHeight = DIMENSIONS.RESPONSE_BUTTON_HEIGHT;
    let buttonSpacing = SPACING.BUTTON_SPACING;
    
    let navTotalWidth = (2 * navButtonWidth) + navSpacing;
    let navStartX = (width - navTotalWidth) / 2;
    let buttonY = contentHeight + bottomMargin + responseButtonHeight + buttonSpacing + 20; // Extra spacing to prevent overlap
    
    let prevBtn = createButton('← Previous');
    prevBtn.position(navStartX, buttonY);
    prevBtn.size(navButtonWidth, buttonHeight);
    prevBtn.style('font-size', fontSize);
    prevBtn.style('font-weight', 'bold');
    prevBtn.style('background-color', '#ffffff');
    prevBtn.style('color', '#333');
    prevBtn.style('border', '2px solid #dee2e6');
    prevBtn.style('border-radius', '8px');
    prevBtn.style('cursor', 'pointer');
    prevBtn.style('box-shadow', '0 4px 12px rgba(0,0,0,0.15)');
    prevBtn.style('position', 'absolute');
    prevBtn.style('z-index', '1000');
    prevBtn.mousePressed(() => {
      if (currentPair > 0) {
        // Go to previous pair
        currentPair--;
        updateButtonHighlights();
        updateNavigationUI();
        scrollToTop();
      } else if (currentPair === 0) {
        // Go back to intro page from first pair
        surveyStarted = false;
        // Remove buttons completely so they can be recreated when survey starts again
        cleanupButtons();
        // Reset currentPair to ensure clean state
        currentPair = 0;
        // Scroll to top when going back to intro
        scrollToTop();
      }
    });
    navButtons.push(prevBtn);
    
    let nextBtn = createButton('Next →');
    nextBtn.position(navStartX + navButtonWidth + navSpacing, buttonY);
    nextBtn.size(navButtonWidth, buttonHeight);
    nextBtn.style('font-size', fontSize);
    nextBtn.style('font-weight', 'bold');
    nextBtn.style('border-radius', '8px');
    nextBtn.style('box-shadow', '0 4px 12px rgba(0,0,0,0.15)');
    nextBtn.style('position', 'absolute');
    nextBtn.style('z-index', '1000');
    nextBtn.class('nav-btn');
    
    // Set initial state (disabled by default)
    updateNextButtonState();
    
    nextBtn.mousePressed(() => {
      // Always check condition - don't rely on disabled attribute
      if (!hasResponseForCurrentPair()) {
        alert('Please select "Same User" or "Different Users" before proceeding.');
        return;
      }
      
      if (currentPair === textPairs.length - 1) {
        displayCompletion();
        scrollToTop();
      } else if (currentPair < textPairs.length - 1) {
        currentPair++;
        updateButtonHighlights();
        updateNavigationUI();
        scrollToTop();
      }
    });
    navButtons.push(nextBtn);
  }

  function updateNavigationUI() {
    // Update Previous button state - always enabled (can go back to intro from first pair)
    updatePreviousButtonState();
    
    // Update Next button state based on whether there's a response
    updateNextButtonState();
  }

  function generateSessionId() {
    return 'session_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
  }

  // Calculate response statistics (helper function to avoid duplication)
  function calculateResponseStatistics(responses) {
    const sameUserCount = responses.filter(r => r.userResponse === 'same_user').length;
    const differentUserCount = responses.filter(r => r.userResponse === 'different_users').length;
    const correctCount = responses.filter(r => r.userResponse === r.actualType).length;
    const totalPairs = responses.length;
    const accuracy = totalPairs > 0 ? ((correctCount / totalPairs) * 100).toFixed(1) : 0;
    
    return {
      sameUserCount,
      differentUserCount,
      correctCount,
      totalPairs,
      accuracy: parseFloat(accuracy)
    };
  }

  // Send survey responses via EmailJS (SDK or REST API)
  async function sendSurveyEmailAutomatic(responses) {
    console.log('🚀 Starting automatic email send...');
    
    // Get current config (checks dynamically for EMAIL_CONFIG_OVERRIDE)
    const currentConfig = getEmailConfig();
    
    // Debug: Log config values (masked for security)
    console.log('📧 EmailJS Config Check:', {
      hasConfig: !!currentConfig,
      hasOverride: typeof EMAIL_CONFIG_OVERRIDE !== 'undefined',
      SERVICE_ID: currentConfig.SERVICE_ID ? currentConfig.SERVICE_ID.substring(0, 8) + '...' : 'missing',
      TEMPLATE_ID: currentConfig.TEMPLATE_ID ? currentConfig.TEMPLATE_ID.substring(0, 8) + '...' : 'missing',
      USER_ID: currentConfig.USER_ID ? currentConfig.USER_ID.substring(0, 4) + '...' : 'missing',
      TO_EMAIL: currentConfig.TO_EMAIL ? currentConfig.TO_EMAIL.replace(/(.{2})(.*)(@.*)/, '$1***$3') : 'missing'
    });
    
    // Validate EmailJS configuration before attempting to send
    const configValid = currentConfig && 
      currentConfig.SERVICE_ID && 
      currentConfig.SERVICE_ID !== 'service_u4bf0vt' &&
      currentConfig.TEMPLATE_ID && 
      currentConfig.TEMPLATE_ID !== 'template_xkica83' &&
      currentConfig.USER_ID && 
      currentConfig.USER_ID !== 'C8w46dTZQHztZTpKB' &&
      currentConfig.TO_EMAIL && 
      !currentConfig.TO_EMAIL.includes('irentala@my.harrisburgu.edu') &&
      currentConfig.API_URL;
    
    if (!configValid) {
      console.error('❌ EmailJS configuration is invalid or missing');
      console.error('   Current config values:', {
        SERVICE_ID: currentConfig.SERVICE_ID,
        TEMPLATE_ID: currentConfig.TEMPLATE_ID,
        USER_ID: currentConfig.USER_ID,
        TO_EMAIL: currentConfig.TO_EMAIL,
        isDefault: currentConfig.SERVICE_ID === 'service_u4bf0vt'
      });
      console.error('   EMAIL_CONFIG_OVERRIDE available:', typeof EMAIL_CONFIG_OVERRIDE !== 'undefined');
      return { 
        success: false, 
        error: 'EmailJS configuration is missing or invalid. Please configure config.js with your EmailJS credentials.' 
      };
    }
    
    // Prepare email data
    const timestamp = new Date().toLocaleString();
    const sessionId = generateSessionId();
    
    // Calculate response statistics
    const stats = calculateResponseStatistics(responses);
    const { sameUserCount, differentUserCount, correctCount, totalPairs, accuracy } = stats;
    
    // Format responses for email - strip large arrays to stay under 50KB limit
    const lightweightResponses = responses.map(r => ({
      displayOrder: r.displayOrder,
      pairId: r.pairId,
      actualType: r.actualType,
      userResponse: r.userResponse,
      timestamp: r.timestamp,
      difficulty: r.difficulty,
      // Only include summary stats, not raw arrays (intervals can be huge)
      text1KeystrokeData: {
        avgTypingSpeed: r.text1KeystrokeData?.avgTypingSpeed,
        avgKeyHoldTime: r.text1KeystrokeData?.avgKeyHoldTime,
        avgKeyInterval: r.text1KeystrokeData?.avgKeyInterval,
        pauseHistogram: r.text1KeystrokeData?.pauseHistogram ? 'present' : null,
        burstHistogram: r.text1KeystrokeData?.burstHistogram ? 'present' : null
      },
      text2KeystrokeData: {
        avgTypingSpeed: r.text2KeystrokeData?.avgTypingSpeed,
        avgKeyHoldTime: r.text2KeystrokeData?.avgKeyHoldTime,
        avgKeyInterval: r.text2KeystrokeData?.avgKeyInterval,
        pauseHistogram: r.text2KeystrokeData?.pauseHistogram ? 'present' : null,
        burstHistogram: r.text2KeystrokeData?.burstHistogram ? 'present' : null
      }
    }));
    
    const responseDataWithSummary = {
      summary: {
        timestamp: timestamp,
        session_id: sessionId,
        total_pairs: totalPairs,
        same_user_responses: sameUserCount,
        different_user_responses: differentUserCount,
        correct_responses: correctCount,
        accuracy_percentage: accuracy
      },
      responses: lightweightResponses
    };
    const responseData = JSON.stringify(responseDataWithSummary, null, 2);
    
    // EmailJS template parameters
    const templateParams = {
      to_email: currentConfig.TO_EMAIL,
      timestamp: timestamp,
      session_id: sessionId,
      pair_count: responses.length,
      same_user_count: sameUserCount,
      different_user_count: differentUserCount,
      correct_count: correctCount,
      accuracy: accuracy,
      response_data: responseData
    };
    
    try {
      // Try EmailJS SDK first (if loaded)
      if (typeof emailjs !== 'undefined') {
        console.log('📧 Using EmailJS SDK...');
        const response = await emailjs.send(
          currentConfig.SERVICE_ID,
          currentConfig.TEMPLATE_ID,
          templateParams
        );
        console.log('✅ Email sent successfully via SDK!', response);
        return { success: true, response: response };
      }
      
      // Fallback: Use REST API directly
      console.log('📤 EmailJS SDK not loaded, using REST API...');
      
      const emailData = {
        service_id: currentConfig.SERVICE_ID,
        template_id: currentConfig.TEMPLATE_ID,
        user_id: currentConfig.USER_ID,
        template_params: templateParams
      };
      
      const response = await fetch(currentConfig.API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(emailData)
      });
      
      if (response.ok) {
        console.log(' Email sent successfully via REST API!');
        return { success: true, response: await response.text() };
      } else {
        const errorText = await response.text();
        console.error(' EmailJS API error:', response.status, errorText);
        return { success: false, error: `API error: ${response.status} - ${errorText}` };
      }
      
    } catch (error) {
      console.error(' Email send failed:', error);
      return { success: false, error: error };
    }
  }

  // Open mailto link as fallback with results in body
  function openMailtoFallback() {
    const subject = encodeURIComponent('Text Keystroke Analysis Survey Responses');
    const timestamp = new Date().toLocaleString();
    
    // Format responses summary for email body
    let responseSummary = 'Survey Response Summary:\n\n';
    responseSummary += `Timestamp: ${timestamp}\n`;
    responseSummary += `Total Pairs Completed: ${userResponses.length}\n\n`;
    
    const stats = calculateResponseStatistics(userResponses);
    const { sameUserCount, differentUserCount, correctCount, totalPairs, accuracy } = stats;
    
    responseSummary += `Same User Responses: ${sameUserCount}\n`;
    responseSummary += `Different User Responses: ${differentUserCount}\n`;
    responseSummary += `Correct Responses: ${correctCount}\n`;
    responseSummary += `Accuracy: ${accuracy}%\n\n`;
    
    responseSummary += 'Detailed Responses:\n';
    userResponses.forEach((response) => {
      const pairNum = response.displayOrder + 1;
      const responseText = response.userResponse === 'same_user' ? 'Same User' : 'Different Users';
      const actualText = response.actualType === 'same_user' ? 'Same User' : 'Different Users';
      responseSummary += `Pair ${pairNum}: ${responseText} (Actual: ${actualText})\n`;
    });
    
    // Create lightweight version for JSON (exclude large arrays)
    const lightweightResponses = userResponses.map(r => ({
      displayOrder: r.displayOrder,
      pairId: r.pairId,
      actualType: r.actualType,
      userResponse: r.userResponse,
      timestamp: r.timestamp,
      difficulty: r.difficulty
    }));
    
    responseSummary += '\n\nFull JSON Data:\n';
    responseSummary += JSON.stringify(lightweightResponses, null, 2);
    
    const body = encodeURIComponent(responseSummary);
    
    const mailtoLink = `mailto:${EMAIL_CONFIG.TO_EMAIL}?subject=${subject}&body=${body}`;
    window.open(mailtoLink, '_blank');
  }

  function displayCompletion() {
    isComplete = true;
    
    // Clear the canvas
    background(COLORS.BACKGROUND);
    
    // Hide all navigation and response buttons
    navButtons.forEach(btn => btn.hide());
    buttons.forEach(btn => btn.hide());
    
    // Responsive sizing
    let isMobile = isMobileDevice();
    let margin = isMobile ? 20 : 80;
    let contentWidth = width - (2 * margin);
    
    // Show completion message
    push();
    textAlign(CENTER, CENTER);
    textSize(isMobile ? 22 : 28);
    fill(COLORS.TEXT_PRIMARY);
    text('🎉 Analysis Complete!', margin, isMobile ? 40 : 60, contentWidth);
    
    textSize(isMobile ? 14 : 16);
    fill(COLORS.TEXT_SECONDARY);
    let line1Y = isMobile ? 80 : 110;
    text('Thank you for participating in our keystroke analysis study.', margin, line1Y, contentWidth);
    pop();
    
    // Display results summary
    let resultsY = isMobile ? 120 : 150;
    let resultsBoxWidth = isMobile ? contentWidth : Math.min(700, contentWidth);
    let resultsBoxX = isMobile ? margin : width/2 - resultsBoxWidth/2;
    
    // Results box
    fill(255);
    stroke(200);
    strokeWeight(2);
    // Calculate dynamic height based on number of pairs
    let baseHeight = isMobile ? 180 : 200; // Base height for title, summary, and spacing
    let pairHeight = isMobile ? 18 : 20; // Height per pair
    let pairsHeight = userResponses.length * pairHeight;
    let resultsBoxHeight = baseHeight + pairsHeight + 40; // Add padding
    rect(resultsBoxX, resultsY, resultsBoxWidth, resultsBoxHeight, 10);
    noStroke();
    
    // Results title
    push();
    textAlign(CENTER, TOP);
    textSize(isMobile ? 18 : 22);
    fill(COLORS.TEXT_PRIMARY);
    textStyle(BOLD);
    text('Your Responses Summary', resultsBoxX, resultsY + 20, resultsBoxWidth);
    pop();
    
    // Calculate statistics
    const stats = calculateResponseStatistics(userResponses);
    const { sameUserCount, differentUserCount, correctCount, totalPairs, accuracy } = stats;
    
    // Display statistics
    let statsY = resultsY + 60;
    push();
    textAlign(LEFT, TOP);
    textSize(isMobile ? 13 : 15);
    fill(COLORS.TEXT_SECONDARY);
    textStyle(BOLD);
    text('Summary:', resultsBoxX + 20, statsY);
    
    textStyle(NORMAL);
    textSize(isMobile ? 12 : 14);
    fill(COLORS.TEXT_TERTIARY);
    let lineSpacing = isMobile ? 22 : 26;
    text(`Total Pairs Completed: ${totalPairs}`, resultsBoxX + 20, statsY + 30);
    text(`Same User Responses: ${sameUserCount}`, resultsBoxX + 20, statsY + 30 + lineSpacing);
    text(`Different User Responses: ${differentUserCount}`, resultsBoxX + 20, statsY + 30 + lineSpacing * 2);
    text(`Accuracy: ${accuracy.toFixed(1)}%`, resultsBoxX + 20, statsY + 30 + lineSpacing * 3);
    pop();
    
    // Display response details in a scrollable area
    let detailsY = statsY + 30 + lineSpacing * 4 + 20;
    push();
    textAlign(LEFT, TOP);
    textSize(isMobile ? 11 : 12);
    fill(COLORS.TEXT_SECONDARY);
    textStyle(BOLD);
    text('Response Details:', resultsBoxX + 20, detailsY);
    
    textStyle(NORMAL);
    fill(COLORS.TEXT_QUATERNARY);
    let detailY = detailsY + 25;
    
    // Show all pairs
    for (let i = 0; i < userResponses.length; i++) {
      let response = userResponses[i];
      let pairNum = response.displayOrder + 1;
      let responseText = response.userResponse === 'same_user' ? 'Same User' : 'Different Users';
      let actualText = response.actualType === 'same_user' ? 'Same User' : 'Different Users';
      let correct = response.userResponse === response.actualType ? '✓' : '✗';
      
      text(`Pair ${pairNum}: ${responseText} (Actual: ${actualText}) ${correct}`, 
          resultsBoxX + 20, detailY, resultsBoxWidth - 40);
      detailY += isMobile ? 18 : 20;
    }
    pop();
    
    // Email send button
    let sendBtnY = resultsY + resultsBoxHeight + 30;
    let sendBtnWidth = isMobile ? 200 : 250;
    let sendBtnHeight = isMobile ? 50 : 55;
    let sendBtnX = width/2 - sendBtnWidth/2;
    
    if (!window.sendEmailBtn) {
      window.sendEmailBtn = createButton('📧 SEND RESULTS VIA EMAIL');
      window.sendEmailBtn.position(sendBtnX, sendBtnY);
      window.sendEmailBtn.size(sendBtnWidth, sendBtnHeight);
      window.sendEmailBtn.style('font-size', isMobile ? '15px' : '17px');
      window.sendEmailBtn.style('font-weight', 'bold');
      window.sendEmailBtn.style('background-color', COLORS.EMAIL_BUTTON);
      window.sendEmailBtn.style('color', 'white');
      window.sendEmailBtn.style('border', '3px solid ' + COLORS.NAV_BUTTON_ENABLED_HOVER);
      window.sendEmailBtn.style('border-radius', '8px');
      window.sendEmailBtn.style('cursor', 'pointer');
      window.sendEmailBtn.style('box-shadow', '0 4px 12px rgba(0,0,0,0.15)');
      window.sendEmailBtn.style('transition', 'all 0.2s ease');
      window.sendEmailBtn.style('position', 'absolute');
      window.sendEmailBtn.style('z-index', '1000');
      window.sendEmailBtn.mouseOver(() => {
        window.sendEmailBtn.style('background-color', COLORS.NAV_BUTTON_ENABLED_HOVER);
        window.sendEmailBtn.style('transform', 'translateY(-2px)');
        window.sendEmailBtn.style('box-shadow', '0 6px 16px rgba(0,0,0,0.2)');
      });
      window.sendEmailBtn.mouseOut(() => {
        window.sendEmailBtn.style('background-color', COLORS.EMAIL_BUTTON);
        window.sendEmailBtn.style('transform', 'translateY(0)');
        window.sendEmailBtn.style('box-shadow', '0 4px 12px rgba(0,0,0,0.15)');
      });
      window.sendEmailBtn.mousePressed(async () => {
        // Update button to show sending status
        window.sendEmailBtn.html('📤 Sending Email...');
        window.sendEmailBtn.style('background-color', COLORS.EMAIL_BUTTON_SENDING);
        window.sendEmailBtn.style('cursor', 'wait');
        
        try {
          const result = await sendSurveyEmailAutomatic(userResponses);
          
          if (result.success) {
            // Success!
            window.sendEmailBtn.html('✅ Email Sent Successfully!');
            window.sendEmailBtn.style('background-color', COLORS.EMAIL_BUTTON_SUCCESS);
            
            alert(
              ' SUCCESS!\n\n' +
              'Your survey responses have been emailed to the researcher.\n\n' +
              'Thank you for participating!'
            );
          } else {
            // Auto-send failed - offer fallback
            window.sendEmailBtn.html('📧 SEND RESULTS VIA EMAIL');
            window.sendEmailBtn.style('background-color', COLORS.EMAIL_BUTTON);
            window.sendEmailBtn.style('cursor', 'pointer');
            
            const openEmail = confirm(
              ' Automatic email send failed.\n\n' +
              'Would you like to open your email client to send manually?\n\n' +
              '(OK = Open email client, Cancel = Skip)'
            );
            
            if (openEmail) {
              openMailtoFallback();
              alert(
                ' Email client opened!\n\n' +
                'Your responses will be included in the email body.\n' +
                'Please click Send.'
              );
            }
          }
        } catch (error) {
          console.error('Email send error:', error);
          
          // Reset button
          window.sendEmailBtn.html('📧 SEND RESULTS VIA EMAIL');
          window.sendEmailBtn.style('background-color', COLORS.EMAIL_BUTTON);
          window.sendEmailBtn.style('cursor', 'pointer');
          
          // Show manual option
          const openEmail = confirm(
            ' Automatic email send failed.\n\n' +
            'Would you like to open your email client to send manually?\n\n' +
            '(OK = Open email client, Cancel = Skip)'
          );
          
          if (openEmail) {
            openMailtoFallback();
          }
        }
      });
    }
    
    // Final thank you message
    let finalY = sendBtnY + sendBtnHeight + 30;
    push();
    textAlign(CENTER, CENTER);
    textSize(isMobile ? 12 : 14);
    fill(120);
    text('Thank you for your participation!', margin, finalY, contentWidth);
    
    textSize(isMobile ? 11 : 12);
    fill(140);
    text('Your responses help advance keystroke analysis research.', margin, finalY + 25, contentWidth);
    pop();
  }



