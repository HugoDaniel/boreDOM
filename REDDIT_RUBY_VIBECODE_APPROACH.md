Ruby is the perfect language for this style of vibe coding
This is an experiment, a fun one I think, complete with working proof-of-concept.

I wanted to see how far you can get 'vibe coding' Ruby using only small LLM's and cleverly using Ruby's strengths.
AFAIK this a new method of vibe coding but I didn't research the internets very deeply. Quote from the readme file:

The idea is simple, start from an application template: one line of code that calls a method that does not yet exist.
Execute the code. Ruby's method_missing will intercept the call to the missing method.
Ask an LLM to write code for this method given a description of the app.
Then repeat: run app again, fill in more missing code and fix errors.
Stop when the app returns normal (hopefully the desired) output.

I am calling it Inside-Out Vibe Coding. Ruby is perfect for this style of vibe coding because:

Meta programming like method_missing

Built in Prism code parser

Dependency management: easily add/require dependencies via a gemfile, bundler and Zeitwerk

Duck typing: less code to write, less errors (maybe)

Error handling: Ruby can even intercept syntax errors

For simple programs this actually works. For bigger applications or adding features to existing code more work would be needed.

So how is this different from regular vibe coding? Current (vibe) coding tools use big LLM's to generate one or more complete files in one go. Then the code is executed and error messages given as feedback to the model. Inside-Out Vibe Coding, as the name suggests first runs the program, finds out what needs changing, only then runs an LLM. It repeats this cycle to work its way out. This is more or less the exact opposite of vibe coding with big LLM's.

Some things learned along the way:

Using Ruby to support this style of coding was surprisingly easy

Prism docs are difficult to understand. Some concrete examples would have been nice

There are various unexpected calls to method_missing that needed handling

Found a segmentation fault in BasicObject

This is the iovc repo. More information in the readme file.
