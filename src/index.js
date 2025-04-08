export default {
    async fetch(request, env) {
        if (request.url.endsWith('/api/chat')) {
            if (request.method === 'POST') {
                return handleChatRequest(request, env);
            }
            return new Response('Method not allowed', { status: 405 });
        }

        return new Response(HTML, { headers: { 'Content-Type': 'text/html' } });
    }
};

async function handleChatRequest(request, env) {
    try {
        const { messages, modelProvider, modelName } = await request.json();

        const response = await fetchChatResponse(modelProvider, modelName, messages, env);
        if (!response.ok) {
            if (response.status === 424) {
                return new Response(JSON.stringify({
                    response: "Prompt blocked due to security configurations",
                    modelProvider: modelProvider
                }), { headers: { 'Content-Type': 'application/json' } });
            }
            throw new Error(`AI Gateway Error: ${response.status}`);
        }

        const aiMessage = await getAIMessage(response, modelProvider);
        return new Response(JSON.stringify({
            response: markdownToHTML(aiMessage),
            modelProvider: modelProvider
        }), { headers: { 'Content-Type': 'application/json' } });

    } catch (error) {
        console.error("Error handling chat request:", error);
        return new Response(JSON.stringify({ 
            error: error.message,
            modelProvider: "error" 
        }), { status: 500, headers: { 'Content-Type': 'application/json' } });
    }
}

async function fetchChatResponse(modelProvider, modelName, messages, env) {
    const url = modelProvider === 'openai'
        ? `https://gateway.ai.cloudflare.com/v1/${env.ACCOUNT_ID}/${env.GATEWAY_NAME}/openai/chat/completions`
        : `https://gateway.ai.cloudflare.com/v1/${env.ACCOUNT_ID}/${env.GATEWAY_NAME}/workers-ai/v1/chat/completions`;

    const headers = {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${modelProvider === 'openai' ? env.OPENAI_TOKEN : env.WORKERSAI_TOKEN}`,
        'cf-aig-authorization': `Bearer ${env.AI_GATEWAY_TOKEN}`,
    };

    const body = JSON.stringify({
        model: modelName,
        messages: modelProvider === 'workersai' ? formatMessages(messages) : messages,
        ...(modelProvider === 'workersai' && { max_tokens: 1000 })
    });

    return fetch(url, { method: 'POST', headers, body });
}

function formatMessages(messages) {
    return messages.map(msg => ({
        role: msg.role === 'user' ? 'user' : 'assistant',
        content: msg.content
    }));
}

async function getAIMessage(response, modelProvider) {
    try {
        const result = await response.json();
        if (modelProvider === 'openai') {
            return result.choices[0].message.content;
        } else if (modelProvider === 'workersai') {
            return result.response || (result.choices && result.choices[0]?.message?.content) || "Unable to parse AI response";
        }
    } catch (error) {
        console.error("Error parsing AI response:", error);
        return "Error parsing AI response.";
    }
}

function markdownToHTML(markdown) {
    if (!markdown) return '';
    markdown = markdown
        .replace(/&/g, '&')
        .replace(/</g, '<')
        .replace(/>/g, '>');
    markdown = markdown.replace(/```([\s\S]*?)```/g, (_, code) => `<pre><code>${code.trim()}</code></pre>`);
    markdown = markdown.replace(/`([^`]+)`/g, (_, code) => `<code>${code}</code>`);
    markdown = markdown.replace(/^###### (.*$)/gm, '<h6>$1</h6>');
    markdown = markdown.replace(/^##### (.*$)/gm, '<h5>$1</h5>');
    markdown = markdown.replace(/^#### (.*$)/gm, '<h4>$1</h4>');
    markdown = markdown.replace(/^### (.*$)/gm, '<h3>$1</h3>');
    markdown = markdown.replace(/^## (.*$)/gm, '<h2>$1</h2>');
    markdown = markdown.replace(/^# (.*$)/gm, '<h1>$1</h1>');
    markdown = markdown.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
    markdown = markdown.replace(/\*(.*?)\*/g, '<em>$1</em>');
    markdown = markdown.replace(/^\s*-\s+(.*)$/gm, '<li>$1</li>');
    markdown = markdown.replace(/(<li>.*?<\/li>)/gs, '<ul>$1</ul>');
    markdown = markdown.replace(/(<ul>.*?<\/ul>)/gs, match => match.replace(/<\/ul><ul>/g, ''));
    markdown = markdown.replace(/(^|\n)(?!<h|<ul|<pre|<li|<code|<strong|<em)(.+?)(?=\n|$)/g, '<p>$2</p>');
    return markdown;
}

const HTML = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Corporate AI Chat</title>
    <style>
        /* Styles omitted for brevity */
    </style>
</head>
<body>
    <div class="container">
        <button class="menu-toggle" onclick="toggleSidebar()">☰</button>
        <div class="sidebar" id="sidebar">
            <h2>Corporate AI Chat</h2>
            <div class="model-selector">
                <label for="modelProviderSelect">Provider:</label>
                <select id="modelProviderSelect" onchange="updateModelOptions()">
                    <option value="openai">OpenAI</option>
                    <option value="workersai">CF WorkersAI</option>
                </select>
                <label for="modelNameSelect">Model:</label>
                <select id="modelNameSelect"></select>
            </div>
        </div>
        <div class="chat-area">
            <div class="chat-messages" id="messages"></div>
            <div class="input-container">
                <div class="input-wrapper">
                    <input type="text" id="userInput" placeholder="Type a message..." />
                    <button onclick="sendMessage()" id="sendButton">Send</button>
                </div>
            </div>
        </div>
    </div>

    <script>
        let messages = [];
        const messagesDiv = document.getElementById('messages');
        const userInput = document.getElementById('userInput');
        const sendButton = document.getElementById('sendButton');
        const modelProviderSelect = document.getElementById('modelProviderSelect');
        const modelNameSelect = document.getElementById('modelNameSelect');
        const sidebar = document.getElementById('sidebar');

        userInput.addEventListener('keyup', function(event) {
            if (event.key === 'Enter') sendMessage();
        });

        function toggleSidebar() {
            sidebar.classList.toggle('open');
        }

        function updateModelOptions() {
            const provider = modelProviderSelect.value;
            modelNameSelect.innerHTML = '';
            if (provider === 'openai') {
                addOption(modelNameSelect, 'gpt-4o-mini', 'gpt-4o-mini');
                addOption(modelNameSelect, 'gpt-4.5-preview', 'gpt-4.5-preview');
            } else if (provider === 'workersai') {
                addOption(modelNameSelect, '@cf/meta/llama-2-7b-chat-fp16', 'llama');
                addOption(modelNameSelect, '@cf/mistral/mistral-7b-instruct-v0.1', 'mistral');
            }
        }

        function addOption(selectElement, value, text) {
            const option = document.createElement('option');
            option.value = value;
            option.textContent = text;
            selectElement.appendChild(option);
        }

        async function sendMessage() {
            const content = userInput.value.trim();
            if (!content) return;

            userInput.disabled = true;
            sendButton.disabled = true;

            messages.push({ role: 'user', content });
            appendMessage('user', content);
            userInput.value = '';

            const modelProvider = modelProviderSelect.value;
            const modelName = modelNameSelect.value;

            try {
                const response = await fetch('/api/chat', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ 
                        messages: messages,
                        modelProvider: modelProvider,
                        modelName: modelName
                    })
                });

                if (!response.ok) throw new Error('Network response was not ok');
                const result = await response.json();

                if (result.error) {
                    appendMessage('ai', '<p>Error: ' + result.error + '</p>');
                } else {
                    appendMessage('ai', result.response);
                    messages.push({ role: 'assistant', content: result.response });
                }
            } catch (error) {
                appendMessage('ai', '<p>Error: Failed to communicate with the server.</p>');
                console.error('Error:', error);
            } finally {
                userInput.disabled = false;
                sendButton.disabled = false;
                userInput.focus();
            }
        }

        function appendMessage(role, content) {
            const messageDiv = document.createElement('div');
            messageDiv.className = 'message ' + role + '-message';
            messageDiv.innerHTML = content;
            messagesDiv.appendChild(messageDiv);
            messagesDiv.scrollTop = messagesDiv.scrollHeight;
        }

        updateModelOptions();
    </script>
</body>
</html>`;