const API_BASE_URL = window.location.origin

let selectedFile = null
let quizData = null
let currentQuestionIndex = 0
let userAnswers = []

const uploadArea = document.getElementById("uploadArea")
const fileInput = document.getElementById("fileInput")
const fileInfo = document.getElementById("fileInfo")
const fileName = document.getElementById("fileName")
const changeFileBtn = document.getElementById("changeFileBtn")
const generateBtn = document.getElementById("generateBtn")
const numQuestions = document.getElementById("numQuestions")
const difficulty = document.getElementById("difficulty")
const questionType = document.getElementById("questionType")
const loadingSpinner = document.getElementById("loadingSpinner")
const errorMessage = document.getElementById("errorMessage")

const uploadSection = document.getElementById("uploadSection")
const quizSection = document.getElementById("quizSection")
const resultsSection = document.getElementById("resultsSection")

const questionContainer = document.getElementById("questionContainer")
const questionCounter = document.getElementById("questionCounter")
const prevBtn = document.getElementById("prevBtn")
const nextBtn = document.getElementById("nextBtn")
const submitBtn = document.getElementById("submitBtn")
const retakeBtn = document.getElementById("retakeBtn")

// Upload handlers
uploadArea.addEventListener("click", () => fileInput.click())

uploadArea.addEventListener("dragover", (e) => {
  e.preventDefault()
  uploadArea.classList.add("drag-over")
})

uploadArea.addEventListener("dragleave", () => {
  uploadArea.classList.remove("drag-over")
})

uploadArea.addEventListener("drop", (e) => {
  e.preventDefault()
  uploadArea.classList.remove("drag-over")
  const files = e.dataTransfer.files
  if (files.length > 0) {
    handleFileSelect(files[0])
  }
})

fileInput.addEventListener("change", (e) => {
  if (e.target.files.length > 0) {
    handleFileSelect(e.target.files[0])
  }
})

changeFileBtn.addEventListener("click", () => {
  selectedFile = null
  userAnswers = []
  fileInfo.classList.add("hidden")
  uploadArea.classList.remove("hidden")
  generateBtn.disabled = true
  fileInput.value = ""
})

function handleFileSelect(file) {
  const allowedTypes = [
    "text/plain",
    "application/pdf",
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ]

  if (!allowedTypes.includes(file.type)) {
    showError("Invalid file type. Please upload PDF, DOCX, DOC, or TXT files.")
    return
  }

  selectedFile = file
  fileName.textContent = `File: ${file.name}`
  uploadArea.classList.add("hidden")
  fileInfo.classList.remove("hidden")
  generateBtn.disabled = false
  userAnswers = []
  currentQuestionIndex = 0
  errorMessage.classList.add("hidden")
}

generateBtn.addEventListener("click", async () => {
  if (!selectedFile) {
    showError("Please select a file first.")
    return
  }

  const reader = new FileReader()
  reader.onload = async (e) => {
    let fileContent = e.target.result

    // Handle PDF and DOCX files
    if (selectedFile.type === "application/pdf") {
      try {
        fileContent = await extractTextFromPDF(fileContent)
      } catch (err) {
        showError("Error reading PDF file. Please try a TXT or DOCX file.")
        return
      }
    } else if (selectedFile.type === "application/vnd.openxmlformats-officedocument.wordprocessingml.document") {
      try {
        fileContent = await extractTextFromDOCX(fileContent)
      } catch (err) {
        showError("Error reading DOCX file. Please try a TXT file.")
        return
      }
    }

    if (typeof fileContent === "object") {
      fileContent = JSON.stringify(fileContent)
    }

    await generateQuiz(fileContent)
  }

  if (selectedFile.type === "text/plain") {
    reader.readAsText(selectedFile)
  } else if (selectedFile.type === "application/pdf") {
    reader.readAsArrayBuffer(selectedFile)
  } else if (
    selectedFile.type === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
    selectedFile.type === "application/msword"
  ) {
    reader.readAsArrayBuffer(selectedFile)
  }
})

async function extractTextFromPDF(arrayBuffer) {
  const base64String = btoa(String.fromCharCode.apply(null, new Uint8Array(arrayBuffer)))

  const response = await fetch(`${API_BASE_URL}/api/extract-pdf`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ file: base64String }),
  })

  if (!response.ok) throw new Error("Failed to extract PDF")
  const data = await response.json()
  return data.text || ""
}

async function extractTextFromDOCX(arrayBuffer) {
  const base64String = btoa(String.fromCharCode.apply(null, new Uint8Array(arrayBuffer)))

  const response = await fetch(`${API_BASE_URL}/api/extract-docx`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ file: base64String }),
  })

  if (!response.ok) throw new Error("Failed to extract DOCX")
  const data = await response.json()
  return data.text || ""
}

async function generateQuiz(fileContent) {
  if (fileContent.length < 100) {
    showError("File content is too short. Please upload a file with more content.")
    return
  }

  loadingSpinner.classList.remove("hidden")
  errorMessage.classList.add("hidden")

  try {
    const response = await fetch(`${API_BASE_URL}/api/generate-quiz`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        content: fileContent,
        numQuestions: Number.parseInt(numQuestions.value),
        difficulty: difficulty.value,
        questionType: questionType.value,
      }),
    })

    if (!response.ok) {
      const errorData = await response.json()
      throw new Error(errorData.error || "Failed to generate quiz")
    }

    const data = await response.json()
    quizData = data.questions
    userAnswers = new Array(quizData.length).fill(null)

    loadingSpinner.classList.add("hidden")
    uploadSection.classList.add("hidden")
    quizSection.classList.remove("hidden")
    resultsSection.classList.add("hidden")

    currentQuestionIndex = 0
    displayQuestion()
  } catch (error) {
    loadingSpinner.classList.add("hidden")
    showError(error.message || "Failed to generate quiz. Please try again.")
  }
}

function displayQuestion() {
  const question = quizData[currentQuestionIndex]
  let optionsHTML = ""

  if (question.type === "true_false") {
    const options = ["True", "False"]
    optionsHTML = options
      .map(
        (opt, idx) => `
            <div class="option ${userAnswers[currentQuestionIndex] === idx ? "selected" : ""}">
                <input type="radio" name="answer" value="${idx}" ${userAnswers[currentQuestionIndex] === idx ? "checked" : ""}>
                <label>${opt}</label>
            </div>
        `,
      )
      .join("")
  } else {
    optionsHTML = question.options
      .map(
        (opt, idx) => `
            <div class="option ${userAnswers[currentQuestionIndex] === idx ? "selected" : ""}">
                <input type="radio" name="answer" value="${idx}" ${userAnswers[currentQuestionIndex] === idx ? "checked" : ""}>
                <label>${opt}</label>
            </div>
        `,
      )
      .join("")
  }

  questionContainer.innerHTML = `
        <div class="question">
            <div class="question-type">${question.type === "true_false" ? "True/False" : "Multiple Choice"}</div>
            <div class="question-text">${currentQuestionIndex + 1}. ${question.question}</div>
            <div class="options">${optionsHTML}</div>
        </div>
    `

  questionCounter.textContent = `${currentQuestionIndex + 1} of ${quizData.length}`

  prevBtn.disabled = currentQuestionIndex === 0
  nextBtn.style.display = currentQuestionIndex === quizData.length - 1 ? "none" : "block"
  submitBtn.style.display = currentQuestionIndex === quizData.length - 1 ? "block" : "none"

  // Add event listeners to options
  document.querySelectorAll(".option input").forEach((input) => {
    input.addEventListener("change", (e) => {
      userAnswers[currentQuestionIndex] = Number.parseInt(e.target.value)
      document.querySelectorAll(".option").forEach((opt) => opt.classList.remove("selected"))
      e.target.closest(".option").classList.add("selected")
    })
  })
}

prevBtn.addEventListener("click", () => {
  if (currentQuestionIndex > 0) {
    currentQuestionIndex--
    displayQuestion()
  }
})

nextBtn.addEventListener("click", () => {
  if (currentQuestionIndex < quizData.length - 1) {
    currentQuestionIndex++
    displayQuestion()
  }
})

submitBtn.addEventListener("click", showResults)
retakeBtn.addEventListener("click", resetQuiz)

function showResults() {
  let score = 0
  let resultsDetailsHTML = ""

  quizData.forEach((question, idx) => {
    const isCorrect = userAnswers[idx] === question.correctAnswer
    if (isCorrect) score++

    let userAnswer = ""
    let correctAnswer = ""

    if (question.type === "true_false") {
      userAnswer = userAnswers[idx] !== null ? ["True", "False"][userAnswers[idx]] : "Not answered"
      correctAnswer = ["True", "False"][question.correctAnswer]
    } else {
      userAnswer = userAnswers[idx] !== null ? question.options[userAnswers[idx]] : "Not answered"
      correctAnswer = question.options[question.correctAnswer]
    }

    resultsDetailsHTML += `
            <div class="result-item ${isCorrect ? "correct" : "incorrect"}">
                <div class="result-question">Q${idx + 1}: ${question.question}</div>
                <div class="result-answer">Your answer: <strong>${userAnswer}</strong></div>
                <div class="result-answer">Correct answer: <strong>${correctAnswer}</strong></div>
            </div>
        `
  })

  const percentage = Math.round((score / quizData.length) * 100)
  document.getElementById("scorePercentage").textContent = percentage + "%"
  document.getElementById("scoreText").textContent = `You scored ${score} out of ${quizData.length}`
  document.getElementById("resultsDetails").innerHTML = resultsDetailsHTML

  quizSection.classList.add("hidden")
  resultsSection.classList.remove("hidden")
}

function resetQuiz() {
  selectedFile = null
  quizData = null
  currentQuestionIndex = 0
  userAnswers = []
  fileInfo.classList.add("hidden")
  uploadArea.classList.remove("hidden")
  uploadSection.classList.remove("hidden")
  quizSection.classList.add("hidden")
  resultsSection.classList.add("hidden")
  generateBtn.disabled = true
  fileInput.value = ""
}

function showError(message) {
  errorMessage.textContent = message
  errorMessage.classList.remove("hidden")
}
