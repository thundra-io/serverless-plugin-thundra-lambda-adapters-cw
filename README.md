# serverless-plugin-thundra-lambda-adapters-cw

This plugin is a [serverless framework](https://serverless.com/) plugin which subscribes Thundra monitoring Lambda to the monitored functions' CloudWatch log groups for listening and sending monitoring data asynchronously.

## Installation

Install the plugin via NPM: 
```
npm install --save serverless-plugin-thundra-lambda-adapters-cw
```

## Configuration

- `thundraApiKey`: Specifies your API key to be used for sending your monitoring data to our side. This property is *optional* if the API key is configured at monitored Lambda function. Otherwise, it must be configured here. Monitored Lambda function basis API key configuration overrides API key configuration here.
- `thundraAdapterFunctionMemorySize`: Configures the memory size in MB of the adapter Lambda function which collects monitoring data over CloudWatch. This property is *optional*. Default value is `512` MB.
- `thundraAdapterFunctionTimeout`: Configures the timeout in milliseconds of the adapter Lambda function which collects monitoring data over CloudWatch. This property is *optional*. Default value is `300` seconds (5 minutes).
- `thundraSkipAllLogGroupCreations`: Skips log group creations for all functions to be monitored. By default this plugin create log groups of monitored functions to subscribe them. But if the log group is already created without this plugin (by invocation or manually), log group creation should be skipped, otherwise you will get log group already exist error. This property is *optional*. Default value is `false`.

Example configuration:
```yml
custom:
  ...
  thundraApiKey: <my-api-key>
  thundraAdapterFunctionMemorySize: 1536
  thundraAdapterFunctionTimeout: 100
  thundraSkipAllLogGroupCreations: true
  ...
```

## Usage

By default all functions are monitored over AWS CloudWatch. If you want to exclude specific ones, you need to mark your functions by setting `thundraIgnored` flag to `true`.

Example usage:
```yml
functions:
  my-function:
      ...
      thundraIgnored: true
      ...
  ...    
```

- `thundraSkipLogGroupCreation`: *Optionally* log group creation for the specific function can be disabled by this flag.

Example usage:
```yml
functions:
  my-function:
      ...
      skipLogGroupCreation: true
      ...
  ...    
```

