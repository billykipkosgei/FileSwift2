const { exec } = require('child_process');

exec('npx tailwindcss -i ./src/input.css -o ./dist/output.css', (error, stdout, stderr) => {
    if (error) {
        console.error(`Error: ${error}`);
        return;
    }
    console.log(`stdout: ${stdout}`);
    console.log(`stderr: ${stderr}`);
});
