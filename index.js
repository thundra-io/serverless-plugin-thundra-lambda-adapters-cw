'use strict';

module.exports = class ThundraLambdaAdaptersCloudWatchPlugin {

    constructor(serverless) {
        this.provider = 'aws';
        this.serverless = serverless;
        this.hooks = {
            'before:deploy:createDeploymentArtifacts': this.beforeDeployCreateDeploymentArtifacts.bind(this)
        };
    }

    beforeDeployCreateDeploymentArtifacts() {
        const me = this;
        const aws = this.serverless.getProvider('aws');
        const region = aws.options.region;
        const stage = aws.options.stage;
        const adapterResourceName = "thundra-lambda-adapters-cw";
        return aws.request(
            "S3",
            "listObjectVersions",
            {
                Bucket: "thundra-dist-" + region,
                Prefix: adapterResourceName + ".jar",
            },
            stage,
            region)
            .then(function(response, err) {
                    if (err) {
                        throw new Error(err.message);
                    }
                    var adapterArtifactLatestVersionId = response.Versions[0].VersionId;
                    me.beforeDeployCreateDeploymentArtifacts0(adapterResourceName, adapterArtifactLatestVersionId);
                }
            );
    }

    beforeDeployCreateDeploymentArtifacts0(adapterResourceName, adapterArtifactLatestVersionId) {
        const aws = this.serverless.getProvider('aws');
        const region = aws.options.region;
        const stage = aws.options.stage ? aws.options.stage : "default";
        const cli = this.serverless.cli;
        const service = this.serverless.service;
        const serviceName = service.service;
        const functions = service.functions;

        ///////////////////////////////////////////////////////////////////////////////////////////////////////////////

        cli.log("[THUNDRA] Let the AWS Lambda Monitoring Begin ...");
        cli.log("[THUNDRA] =====================================================================");
        cli.log("[THUNDRA] Using Thundra Lambda CloudWatch Adapter artifact with version id " + adapterArtifactLatestVersionId + " ...");

        ///////////////////////////////////////////////////////////////////////////////////////////////////////////////

        if (functions) {
            const template = service.provider.compiledCloudFormationTemplate;
            template.Resources = template.Resources || {};

            ///////////////////////////////////////////////////////////////////////////////////////////////////////////

            var awsRegion = "us-west-2";
            if (service.custom && service.custom.thundraAwsRegion) {
                awsRegion = service.custom.thundraAwsRegion;
            }

            var adapterFunctionMemorySize = 512;
            if (service.custom && service.custom.thundraAdapterFunctionMemorySize) {
                adapterFunctionMemorySize = service.custom.thundraAdapterFunctionMemorySize;
            }

            var adapterFunctionTimeout = 300;
            if (service.custom && service.custom.thundraAdapterFunctionTimeout) {
                adapterFunctionTimeout = service.custom.thundraAdapterFunctionTimeout;
            }

            var skipAllLogGroupCreations = false;
            if (service.custom && service.custom.thundraSkipAllLogGroupCreations) {
                skipAllLogGroupCreations = service.custom.thundraSkipAllLogGroupCreations;
            }

            ///////////////////////////////////////////////////////////////////////////////////////////////////////////

            var adapterFunctionName = "thundra-lambda-adapters-cw-" + stage + "-" + serviceName;
            if (service.custom && service.custom.thundraAdapterFunctionName) {
                adapterFunctionName = service.custom.thundraAdapterFunctionName;
            }
            const adapterNormalizedFunctionName = aws.naming.getNormalizedFunctionName(adapterFunctionName);

            ///////////////////////////////////////////////////////////////////////////////////////////////////////////

            const adapterRoleResourceId = this.getNormalizedName(aws.naming, adapterFunctionName + region + "Role");
            var adapterRoleName = this.getNormalizedName(aws.naming, adapterFunctionName + region + "Role");
            if (service.custom && service.custom.thundraAdapterRoleName) {
                adapterRoleName = service.custom.thundraAdapterRoleName;
            }

            cli.log("[THUNDRA] Adding " + adapterRoleName + " role for required permissions ...");

            const targetLogGroups = [];
            targetLogGroups.push({
                "Fn::Join": [
                    "",
                    [
                        "arn:aws:logs:",
                        { "Ref": "AWS::Region" },
                        ":",
                        { "Ref": "AWS::AccountId" },
                        ":log-group:" + "/aws/lambda/" + adapterFunctionName + ":*"
                    ]
                ]
            });
            Object.keys(functions).forEach(functionName => {
                const logGroupName = "/aws/lambda/" + functionName;
                targetLogGroups.push({
                    "Fn::Join": [
                        "",
                        [
                            "arn:aws:logs:",
                            { "Ref": "AWS::Region" },
                            ":",
                            { "Ref": "AWS::AccountId" },
                            ":log-group:" + logGroupName + ":*"
                        ]
                    ]
                });
            });

            const adapterRoleResource = {
                Type: "AWS::IAM::Role",
                Properties: {
                    RoleName: adapterRoleName,
                    AssumeRolePolicyDocument: {
                        Version: "2012-10-17",
                        Statement: [{
                            Effect: "Allow",
                            Principal: {
                                Service: [ "lambda.amazonaws.com" ]
                            },
                            Action: "sts:AssumeRole"
                        }]
                    },
                    Policies: [
                        {
                            PolicyName: adapterRoleName + "LogRole",
                            PolicyDocument: {
                                Version : "2012-10-17",
                                Statement: [{
                                    Effect: "Allow",
                                    Action: "logs:*",
                                    Resource: targetLogGroups
                                }]
                            }
                        }
                    ]
                }
            };
            template.Resources[adapterRoleResourceId] = adapterRoleResource;

            ///////////////////////////////////////////////////////////////////////////////////////////////////////////

            cli.log("[THUNDRA] Adding Thundra Lambda CloudWatch Adapter function ...");

            const date = new Date();

            const adapterFnVariables = {
                thundra_awsRegion: awsRegion,
                thundra_deployTime: date
            };
            if (service.custom && service.custom.thundraApiKey) {
                adapterFnVariables["thundra_apiKey"] = service.custom.thundraApiKey;
            }
            if (service.custom && service.custom.thundraAdapterRestUrl) {
                adapterFnVariables["thundra_lambda_adapters_cw_send_rest_baseUrl"] = service.custom.thundraAdapterRestUrl;
            }
            if (service.custom && service.custom.thundraAdapterFnVariables) {
                Object.keys(service.custom.thundraAdapterFnVariables).forEach(variableName => {
                    const variableValue = service.custom.thundraAdapterFnVariables[variableName];
                    adapterFnVariables[variableName] = variableValue;
                });
            }

            const adapterFunctionResourceId = adapterNormalizedFunctionName;
            const adapterFunctionResource = {
                Type: "AWS::Lambda::Function",
                Properties: {
                    FunctionName: adapterFunctionName,
                    Description: "Thundra AWS Lambda Monitoring over CloudWatch Logs",
                    Handler: "io.thundra.lambda.adapters.cw.MonitoringDataCloudWatchHandler",
                    Role: {
                        "Fn::Join": [
                            "",
                            [
                                "arn:aws:iam::",
                                { "Ref": "AWS::AccountId" },
                                ":role/" + adapterRoleName
                            ]
                        ]
                    },
                    MemorySize: adapterFunctionMemorySize,
                    Runtime: "java8",
                    Timeout: adapterFunctionTimeout,
                    Code: {
                        S3Bucket: {
                            "Fn::Join": [
                                "",
                                [
                                    "thundra-dist-",
                                    { "Ref": "AWS::Region" }
                                ]
                            ]
                        },
                        S3Key: adapterResourceName + ".jar",
                        S3ObjectVersion: adapterArtifactLatestVersionId
                    },
                    Environment: {
                        Variables: adapterFnVariables
                    }
                },
                DependsOn: [ adapterRoleResourceId ]
            }
            template.Resources[adapterFunctionResourceId] = adapterFunctionResource;

            const adapterFunctionVersionResourceId = adapterNormalizedFunctionName + "Version";
            const adapterFunctionVersionResource = {
                Type: "AWS::Lambda::Version",
                DeletionPolicy: "Retain",
                Properties: {
                    FunctionName: {
                        Ref: adapterFunctionResourceId
                    }
                }
            }
            template.Resources[adapterFunctionVersionResourceId] = adapterFunctionVersionResource;

            ///////////////////////////////////////////////////////////////////////////////////////////////////////////

            Object.keys(functions).forEach(functionName => {
                const fn = functions[functionName];
                const ignored = fn.thundraIgnored;
                if (ignored != true) {
                    var fnName = functionName;
                    if (fn.name) {
                        fnName = fn.name;
                    }

                    var skipLogGroupCreation = fn.thundraSkipLogGroupCreation;
                    if (skipAllLogGroupCreations == true) {
                        skipLogGroupCreation = true;
                    }

                    const normalizedFunctionName = aws.naming.getNormalizedFunctionName(fnName);
                    // We used normalized function definition name instead of actual function name
                    // to be compatible with Serverless framework.
                    // Otherwise same log group is added with different resource ids and this leads to
                    // already existing log group issue
                    const logGroupResourceId = aws.naming.getNormalizedFunctionName(functionName) + "LogGroup";
                    const logGroupName = "/aws/lambda/" + fnName;

                    ///////////////////////////////////////////////////////////////////////////////////////////////////

                    if (skipLogGroupCreation != true) {
                        cli.log("[THUNDRA] Adding log group " + logGroupName + " for Lambda function " + fnName + " ...");

                        const logGroupResource = {
                            Type: "AWS::Logs::LogGroup",
                            Properties: {
                                LogGroupName: logGroupName
                            }
                        };
                        template.Resources[logGroupResourceId] = logGroupResource;
                    } else {
                        cli.log("[THUNDRA] Skipping log group " + logGroupName + " creation for Lambda function " + fnName + " ...");
                    }

                    ///////////////////////////////////////////////////////////////////////////////////////////////////

                    cli.log("[THUNDRA] Adding log group permission for log group " + logGroupName + " ...");

                    const lambdaLogGroupPermissionResourceId = normalizedFunctionName + "LogGroupPermission";
                    const lambdaLogGroupPermissionResourceDependencies = [ adapterFunctionResourceId ];
                    if (skipLogGroupCreation != true) {
                        lambdaLogGroupPermissionResourceDependencies.push(logGroupResourceId);
                    }
                    const lambdaLogGroupPermissionResource = {
                        Type: "AWS::Lambda::Permission",
                        Properties: {
                            Action: "lambda:InvokeFunction",
                            FunctionName: {
                                "Fn::Join": [
                                    "",
                                    [
                                        "arn:aws:lambda:",
                                        { "Ref": "AWS::Region" },
                                        ":",
                                        { "Ref": "AWS::AccountId" },
                                        ":function:" + adapterFunctionName
                                    ]
                                ]
                            },
                            Principal: {
                                "Fn::Join": [
                                    "",
                                    [
                                        "logs.",
                                        { "Ref": "AWS::Region" },
                                        ".amazonaws.com"
                                    ]
                                ]
                            },
                            SourceAccount: { "Ref": "AWS::AccountId" },
                            SourceArn: {
                                "Fn::Join": [
                                    "",
                                    [
                                        "arn:aws:logs:",
                                        { "Ref": "AWS::Region" },
                                        ":",
                                        { "Ref": "AWS::AccountId" },
                                        ":log-group:" + logGroupName + ":*"
                                    ]
                                ]
                            }
                        },
                        DependsOn: lambdaLogGroupPermissionResourceDependencies
                    }
                    template.Resources[lambdaLogGroupPermissionResourceId] = lambdaLogGroupPermissionResource;

                    ///////////////////////////////////////////////////////////////////////////////////////////////////

                    cli.log("[THUNDRA] Adding log subscription for log group " + logGroupName + " ...");

                    const logGroupSubscriptionId = aws.naming.getNormalizedFunctionName(fnName + "Subscription");
                    const logGroupSubscriptionResourceDepdendencies = [ adapterFunctionResourceId, lambdaLogGroupPermissionResourceId ];
                    if (skipLogGroupCreation != true) {
                        logGroupSubscriptionResourceDepdendencies.push(logGroupResourceId);
                    }
                    const logGroupSubscriptionResource = {
                        Type : "AWS::Logs::SubscriptionFilter",
                        Properties: {
                            DestinationArn: {
                                "Fn::Join": [
                                    "",
                                    [
                                        "arn:aws:lambda:",
                                        { "Ref": "AWS::Region" },
                                        ":",
                                        { "Ref": "AWS::AccountId" },
                                        ":function:" + adapterFunctionName
                                    ]
                                ]
                            },
                            FilterPattern: '{$.type = Invocation || $.type = Trace || $.type = Span || $.type = Metric || $.type = Log || $.type = Composite}',
                            LogGroupName: logGroupName,
                        },
                        DependsOn: logGroupSubscriptionResourceDepdendencies
                    }
                    template.Resources[logGroupSubscriptionId] = logGroupSubscriptionResource;
                }
            });

            cli.log("[THUNDRA] =====================================================================");
        }
    }

    getNormalizedName(naming, name) {
        return naming.normalizeName(name
            .replace(/-/g, '')
            .replace(/_/g, ''));
    }

};
