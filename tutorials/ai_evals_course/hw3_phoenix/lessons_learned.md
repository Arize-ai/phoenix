# Lessons Learned

1. LLM-as-Judge can be a powerful tool for evaluating your LLM applications. 
2. Since LLM-as-Judge evaluators use LLMs themselves, its important to test your evaluators themselves, by comparing against ground truths. 
3. With a much smaller portion of your traces you can still build effective evaluators. Sampling from your traces and dividing into train/dev/test splits allows you to train your evaluators with confidence. 
4. Iterating on your evaluators is important. Only through multiple iterations can you hill-climb and get your evaluators to a spot where you trust them.
5. Prompting your evaluators to produce natural language explanations is very helpful. It allows you to understand what your model is thinking and why. You can use these explanations to iteratively improve upon your evaluator prompt. 
6. Researching prompting strategies and building prompts with these strategies is important not only for your LLM applications, but also for LLM-as-judge evaluators that evaluate such applications. 
7. Testing your evaluators and building evaluators you can trust is crucial. Faulty evaluators may allow bad LLM outputs to pass through to users, such as recommending sugar heavy diets to diabetic users. 
8. Phoenix is an awesome tool to help you build reliable LLM-as-judge evaluators!

Ask me any questions, or just stay in touch here:

https://x.com/PriyanJindal

https://www.linkedin.com/in/priyan-jindal/
