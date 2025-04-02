export default {
    async fetch(request, env) {
        if (request.url.endsWith('/api/chat')) {
            if (request.method === 'POST') {
                try {
                    const { messages, modelProvider, modelName } = await request.json();
                    
                    let response;
                    let result;
                    let aiMessage;
                    
                    if (modelProvider === 'openai') {
                        response = await fetch(`https://gateway.ai.cloudflare.com/v1/${env.ACCOUNT_ID}/${env.GATEWAY_NAME}/openai/chat/completions`, {
                            method: 'POST',
                            headers: {
                                'Content-Type': 'application/json',
                                'Authorization': `Bearer ${env.OPENAI_TOKEN}`,
                                'cf-aig-authorization': `Bearer ${env.AI_GATEWAY_TOKEN}`,
                            },
                            body: JSON.stringify({
                                model: modelName,
                                messages: messages
                            })
                        });
                        if (response.ok) {
                            result = await response.json();
                            aiMessage = result.choices[0].message.content;
                        }
                    } else if (modelProvider === 'workersai') {
                        const formattedMessages = messages.map(msg => ({
                            role: msg.role === 'user' ? 'user' : 'assistant',
                            content: msg.content
                        }));
                        response = await fetch(`https://gateway.ai.cloudflare.com/v1/${env.ACCOUNT_ID}/${env.GATEWAY_NAME}/workers-ai/v1/chat/completions`, {
                            method: 'POST',
                            headers: {
                                'Content-Type': 'application/json',
                                'Authorization': `Bearer ${env.WORKERSAI_TOKEN}`,
                                'cf-aig-authorization': `Bearer ${env.AI_GATEWAY_TOKEN}`,
                            },
                            body: JSON.stringify({
                                model: modelName,
                                messages: formattedMessages,
                                max_tokens: 1000
                            })
                        });
                        if (response.ok) {
                            result = await response.json();
                            aiMessage = result.response || (result.choices && result.choices[0]?.message?.content) || "Unable to parse AI response";
                        }
                    }
                    
                    if (response.status === 424) {
                        return new Response(JSON.stringify({
                            response: "Prompt blocked due to security configurations",
                            modelProvider: modelProvider
                        }), { headers: { 'Content-Type': 'application/json' } });
                    }
                    if (!response.ok) {
                        throw new Error(`AI Gateway Error: ${response.status}`);
                    }

                    return new Response(JSON.stringify({
                        response: markdownToHTML(aiMessage),
                        modelProvider: modelProvider
                    }), { headers: { 'Content-Type': 'application/json' } });

                } catch (error) {
                    console.error("Error details:", error);
                    return new Response(JSON.stringify({ 
                        error: error.message,
                        modelProvider: "error" 
                    }), { status: 500, headers: { 'Content-Type': 'application/json' } });
                }
            }
            return new Response('Method not allowed', { status: 405 });
        }

        return new Response(HTML, { headers: { 'Content-Type': 'text/html' } });
    }
};

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
        * {
            box-sizing: border-box;
        }
        body {
            font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
            margin: 0;
            padding: 0;
            background: #f7f7f8;
            color: #333;
            height: 100vh;
            display: flex;
            overflow: hidden;
        }
        .container {
            display: flex;
            width: 100%;
            height: 100%;
        }
        .sidebar {
            width: 260px;
            background: #202123;
            color: #d9d9e3;
            padding: 20px;
            flex-shrink: 0;
            overflow-y: auto;
            transition: transform 0.3s ease;
        }
        .sidebar h2 {
            font-size: 1.2rem;
            margin: 0 0 20px;
        }
        .model-selector {
            display: flex;
            flex-direction: column;
            gap: 10px;
        }
        .model-selector label {
            font-size: 0.9rem;
            color: #d9d9e3;
        }
        select {
            padding: 8px;
            border: none;
            border-radius: 4px;
            background: #40414f;
            color: #d9d9e3;
            font-size: 0.9rem;
            width: 100%;
        }
        .chat-area {
            flex: 1;
            display: flex;
            flex-direction: column;
            background: #f7f7f8;
            height: 100vh;
            overflow: hidden;
        }
        .chat-messages {
            flex: 1;
            padding: 20px;
            overflow-y: auto;
            width: 100%;
            max-width: 800px;
            margin: 0 auto;
        }
        .message {
            margin-bottom: 15px;
            padding: 12px 16px;
            border-radius: 8px;
            max-width: 85%;
            word-wrap: break-word;
        }
        .user-message {
            background: #343541;
            color: #ececf1;
            margin-left: auto;
        }
        .ai-message {
            background: #ececf1;
            color: #343541;
        }
        .input-container {
            padding: 20px;
            background: #f7f7f8;
            display: flex;
            justify-content: center;
            border-top: 1px solid #e5e5e5;
        }
        .input-wrapper {
            width: 100%;
            max-width: 800px;
            display: flex;
            gap: 10px;
            flex-wrap: wrap;
        }
        input {
            flex: 1;
            padding: 12px;
            border: 1px solid #ddd;
            border-radius: 4px;
            font-size: 1rem;
            outline: none;
            box-shadow: 0 1px 3px rgba(0,0,0,0.1);
            min-width: 0;
        }
        button {
            padding: 12px 20px;
            background: #10a37f;
            color: white;
            border: none;
            border-radius: 4px;
            cursor: pointer;
            font-size: 1rem;
        }
        button:disabled {
            background: #cccccc;
            cursor: not-allowed;
        }
        pre, code {
            background: #f4f4f4;
            padding: 8px;
            border-radius: 4px;
            overflow-x: auto;
        }
        .model-info {
            font-size: 0.8rem;
            color: #666;
            margin-top: 5px;
        }
        .menu-toggle {
            display: none;
            background: none;
            border: none;
            color: #d9d9e3;
            font-size: 1.5rem;
            cursor: pointer;
            padding: 10px;
        }

        /* Mobile Adjustments */
        @media (max-width: 768px) {
            .sidebar {
                position: fixed;
                top: 0;
                left: 0;
                height: 100%;
                transform: translateX(-100%);
                z-index: 1000;
            }
            .sidebar.open {
                transform: translateX(0);
            }
            .menu-toggle {
                display: block;
                position: fixed;
                top: 10px;
                left: 10px;
                z-index: 1100;
            }
            .chat-area {
                width: 100%;
            }
            .chat-messages {
                padding: 10px;
            }
            .message {
                max-width: 90%;
            }
            .input-wrapper {
                flex-direction: column;
                gap: 10px;
            }
            input, button {
                width: 100%;
            }
        }

        @media (max-width: 480px) {
            .chat-messages {
                padding: 5px;
            }
            .message {
                padding: 10px;
                font-size: 0.9rem;
            }
            input, button {
                font-size: 0.9rem;
                padding: 10px;
            }
        }
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