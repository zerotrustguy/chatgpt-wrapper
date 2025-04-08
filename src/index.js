export default {
    async fetch(request, env) {
        if (request.url.endsWith('/api/chat')) {
            if (request.method === 'POST') {
                try {
                    const { messages, modelProvider, modelName } = await request.json();
                    
                    let response;
                    let result;
                    let aiMessage;
                    
                    // Handle different model providers
                    if (modelProvider === 'openai') {
                        // Call OpenAI API
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
                    } 
                    else if (modelProvider === 'workersai') {
                        // Format messages for Workers AI API
                        const formattedMessages = messages.map(msg => ({
                            role: msg.role === 'user' ? 'user' : 'assistant',
                            content: msg.content
                        }));
                        
                        // Call Workers AI API
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
                            
                            // Debug: Log response structure
                            console.log('Workers AI response structure:', JSON.stringify(result));
                            
                            // Fixed: Workers AI has a different response structure
                            // It should be result.response instead of result.content[0].text
                            aiMessage = result.response || 
                                       (result.choices && result.choices[0]?.message?.content) ||
                                       (result.result?.response) ||
                                       (result.result?.content) ||
                                       "Unable to parse AI response";
                        }
                    }
                    
                    if (response.status === 424) {
                        return new Response(JSON.stringify({
                            response: "Prompt blocked due to security configurations",
                            modelProvider: modelProvider
                        }), {
                            headers: { 'Content-Type': 'application/json' }
                        });
                    }

                    if (!response.ok) {
                        throw new Error(`AI Gateway Error: ${response.status}`);
                    }

                    return new Response(JSON.stringify({
                        response: markdownToHTML(aiMessage),
                        modelProvider: modelProvider
                    }), {
                        headers: { 'Content-Type': 'application/json' }
                    });

                } catch (error) {
                    console.error("Error details:", error);
                    return new Response(JSON.stringify({ 
                        error: error.message,
                        modelProvider: "error" 
                    }), {
                        status: 500,
                        headers: { 'Content-Type': 'application/json' }
                    });
                }
            }
            return new Response('Method not allowed', { status: 405 });
        }

        return new Response(HTML, {
            headers: { 'Content-Type': 'text/html' }
        });
    }
};

// Improved Markdown to HTML converter
function markdownToHTML(markdown) {
    if (!markdown) return '';
    
    // Escape HTML to prevent XSS attacks
    markdown = markdown
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');

    // Process code blocks (```code```)
    markdown = markdown.replace(/```([\s\S]*?)```/g, (_, code) => {
        return `<pre><code>${code.trim()}</code></pre>`;
    });

    // Process inline code (`inline`)
    markdown = markdown.replace(/`([^`]+)`/g, (_, code) => {
        return `<code>${code}</code>`;
    });

    // Headers (#, ##, ###, etc.)
    markdown = markdown.replace(/^###### (.*$)/gm, '<h6>$1</h6>');
    markdown = markdown.replace(/^##### (.*$)/gm, '<h5>$1</h5>');
    markdown = markdown.replace(/^#### (.*$)/gm, '<h4>$1</h4>');
    markdown = markdown.replace(/^### (.*$)/gm, '<h3>$1</h3>');
    markdown = markdown.replace(/^## (.*$)/gm, '<h2>$1</h2>');
    markdown = markdown.replace(/^# (.*$)/gm, '<h1>$1</h1>');

    // Bold and Italic
    markdown = markdown.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>'); // Bold
    markdown = markdown.replace(/\*(.*?)\*/g, '<em>$1</em>');             // Italic

    // Lists (unordered and ordered)
    markdown = markdown.replace(/^\s*-\s+(.*)$/gm, '<li>$1</li>');
    markdown = markdown.replace(/^\s*\d+\.\s+(.*)$/gm, '<li>$1</li>');

    // Wrap lists in <ul> or <ol>
    markdown = markdown.replace(/(<li>.*?<\/li>)/gs, '<ul>$1</ul>');
    markdown = markdown.replace(/(<ul>.*?<\/ul>)/gs, match => match.replace(/<\/ul><ul>/g, ''));

    // Paragraphs (wrap non-block elements in <p>)
    markdown = markdown.replace(/(^|\n)(?!<h|<ul|<pre|<li|<code|<strong|<em)(.+?)(?=\n|$)/g, '<p>$2</p>');

    return markdown;
}

const HTML = `<!DOCTYPE html>
<html lang="en">

<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Corporate AI LLM</title>
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
            margin: 0;
            padding: 0;
            background: #f0f0f0;
            color: #333;
            line-height: 1.5;
        }

        .chat-container {
            max-width: 800px;
            margin: 0 auto;
            height: 100vh;
            display: flex;
            flex-direction: column;
        }

        .header {
            padding: 15px 20px;
            background: #fff;
            border-bottom: 1px solid #eee;
            display: flex;
            justify-content: space-between;
            align-items: center;
        }

        h1 {
            margin: 0;
            font-size: 1.8rem;
        }

        .model-selector {
            display: flex;
            align-items: center;
            gap: 10px;
        }

        .model-selector label {
            font-weight: 500;
        }

        select {
            padding: 8px 12px;
            border: 1px solid #ddd;
            border-radius: 4px;
            font-size: 14px;
            background: white;
        }

        .chat-messages {
            flex: 1;
            padding: 20px;
            overflow-y: auto;
        }

        .message {
            margin-bottom: 20px;
            padding: 12px 16px;
            border-radius: 8px;
            max-width: 80%;
        }

        .user-message {
            background: #007bff;
            color: white;
            margin-left: auto;
        }

        .ai-message {
            background: #fff;
            box-shadow: 0 1px 2px rgba(0,0,0,0.1);
        }

        .ai-message.openai {
            border-left: 4px solid #10a37f; /* OpenAI green */
        }

        .ai-message.workersai {
            border-left: 4px solid #ff6700; /* Workers AI orange */
        }

        .input-container {
            padding: 20px;
            background: #fff;
            border-top: 1px solid #eee;
            display: flex;
            gap: 10px;
        }

        input {
            flex: 1;
            padding: 12px;
            border: 1px solid #ddd;
            border-radius: 4px;
            font-size: 16px;
            outline: none;
        }

        button {
            padding: 12px 24px;
            background: #007bff;
            color: white;
            border: none;
            border-radius: 4px;
            cursor: pointer;
            font-size: 16px;
        }

        button:disabled {
            background: #cccccc;
            cursor: not-allowed;
        }

        pre, code {
            background: #f4f4f4;
            padding: 10px;
            border-radius: 4px;
            overflow-x: auto;
        }
        
        .model-info {
            display: flex;
            align-items: center;
            gap: 8px;
            font-size: 12px;
            color: #666;
            margin-top: 4px;
        }
        
        .model-badge {
            padding: 2px 6px;
            border-radius: 4px;
            font-weight: 500;
        }
        
        .model-badge.openai {
            background-color: rgba(16, 163, 127, 0.1);
            color: #10a37f;
        }
        
        .model-badge.workersai {
            background-color: rgba(255, 103, 0, 0.1);
            color: #ff6700;
        }
    </style>
</head>

<body>
    <div class="chat-container">
        <div class="header">
            <h1>Corporate AI LLM</h1>
            <div class="model-selector">
                <label for="modelProviderSelect">Provider:</label>
                <select id="modelProviderSelect" onchange="updateModelOptions()">
                    <option value="openai">OpenAI</option>
                    <option value="workersai">CF WorkersAI</option>
                </select>
                
                <label for="modelNameSelect">Model:</label>
                <select id="modelNameSelect">
                    <!-- OpenAI models (default) -->
                    <option value="gpt-4o-mini">gpt-4o-mini</option>
                    <option value="gpt-4.5-preview">gpt-4.5-preview</option>
                </select>
            </div>
        </div>
        <div class="chat-messages" id="messages"></div>
        <div class="input-container">
            <input type="text" id="userInput" placeholder="Type your message..." />
            <button onclick="sendMessage()" id="sendButton">Send</button>
        </div>
    </div>

    <script>
        let messages = [];
        const messagesDiv = document.getElementById('messages');
        const userInput = document.getElementById('userInput');
        const sendButton = document.getElementById('sendButton');
        const modelProviderSelect = document.getElementById('modelProviderSelect');
        const modelNameSelect = document.getElementById('modelNameSelect');

        // Enter key to send message
        userInput.addEventListener('keyup', function(event) {
            if (event.key === 'Enter') {
                sendMessage();
            }
        });
        
        // Update model options based on selected provider
        function updateModelOptions() {
            const provider = modelProviderSelect.value;
            modelNameSelect.innerHTML = ''; // Clear existing options
            
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

                if (!response.ok) {
                    throw new Error('Network response was not ok');
                }

                const result = await response.json();
                
                if (result.error) {
                    appendMessage('ai', '<p>Error: ' + result.error + '</p>', modelProvider);
                } else {
                    appendMessage('ai', result.response, modelProvider, modelName);
                    messages.push({ role: 'assistant', content: result.response });
                }
            } catch (error) {
                appendMessage('ai', '<p>Error: Failed to communicate with the server. Please try again.</p>', 'error');
                console.error('Error:', error);
            } finally {
                userInput.disabled = false;
                sendButton.disabled = false;
                userInput.focus();
            }
        }

        function appendMessage(role, content, provider, modelName) {
            const messageDiv = document.createElement('div');
            messageDiv.className = 'message ' + role + '-message';
            
            // Add provider-specific class for styling
            if (role === 'ai' && provider) {
                messageDiv.classList.add(provider);
            }
            
            // Add the message content
            messageDiv.innerHTML = content;
            
            // Add model info badge for AI messages
            if (role === 'ai' && provider && provider !== 'error') {
                const modelInfo = document.createElement('div');
                modelInfo.className = 'model-info';
                
                const modelBadge = document.createElement('span');
                modelBadge.className = 'model-badge ' + provider;
                
                // Update to correctly show provider name
                const displayName = provider === 'openai' ? 'OpenAI' : 'CF WorkersAI';
                
                // Get a readable model name part
                let displayModel = modelName;
                if (modelName.includes('/')) {
                    // Extract the last part for WorkersAI models
                    const parts = modelName.split('/');
                    displayModel = parts[parts.length-1];
                } else if (modelName.includes('-')) {
                    // Extract relevant part for OpenAI models
                    //const parts = modelName.split('-');
                    //displayModel = parts[parts.length-1];
					displayModel = modelName
                }
                
                modelBadge.textContent = displayName + ' ' + displayModel;
                
                modelInfo.appendChild(modelBadge);
                messageDiv.appendChild(modelInfo);
            }
            
            messagesDiv.appendChild(messageDiv);
            messagesDiv.scrollTop = messagesDiv.scrollHeight;
        }
        
        // Initialize the page
        updateModelOptions();
    </script>

</body>

</html>`;