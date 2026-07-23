/**
 * @file VirtualPad.cpp
 * @author Luis Camilo Alvarez Carrau
 * @brief Class implementation for a virtual game pad.
 * @version 0.1
 * @date 2026-07-18
 * 
 */
#include "VirtualPad.h"



VirtualPad::VirtualPad(const Napi::CallbackInfo &info)
    : ObjectWrap(info), m_rumbleContext(info.Env())
{
    Napi::Env env = info.Env();

    if (info.Length() < 1) {
        throwError(env, "Incorrect number of arguments!");

        return;
    }

    if (!info[0].IsString()) {
        throwError(env, "Class must be named as first parameter");
        return;
    }

    playerId = info[0].As<Napi::String>().Utf8Value();

    g_padActive = false;
}

VirtualPad::~VirtualPad()
{
    

    if (m_thread.joinable()) {
        m_thread.join();
    }
    if (g_padActive) {
        g_padActive = false;


    vigem_target_remove(m_client, m_pad);
    vigem_target_free(m_pad);
    vigem_disconnect(m_client);
    vigem_free(m_client);

    printf("Cleaning shutdown complete");

    }

}

Napi::Value VirtualPad::test(const Napi::CallbackInfo &info)
{

    Napi::Env env = info.Env();

    if (info.Length() < 1 || !info[0].IsFunction()) {
        throwError(env, "Incorrect Values passed");
    }

    return Napi::Value();
    

}

Napi::Value VirtualPad::startController(const Napi::CallbackInfo &info)
{
    Napi::Env env = info.Env();
    
    if(info.Length() < 1 ||  !info[0].IsFunction()) 
    {
        throwError(env, "Incorrect parameters!");
        return env.Null();
    }
    
    m_rumbleContext = RumbleContext(env);

    Napi::Function funcVal = info[0].As<Napi::Function>();

    m_rumbleContext.tsfn = Napi::ThreadSafeFunction::New(env, funcVal, "RumbleContext", 0, 1, &m_rumbleContext, finalizeCallBack, (void*)nullptr);
    

    g_padActive = true;

    m_client = vigem_alloc();
    if (m_client == nullptr || !VIGEM_SUCCESS(vigem_connect(m_client))) 
    {
        throw std::runtime_error("VigemConnection Failed."); //this might cause a problem if one controller malfunctions and the whole thing just dies.
    }
    
    m_pad = vigem_target_x360_alloc();

    vigem_target_add(m_client, m_pad);

    printf("Adding RumbleCallBack\n");
    vigem_target_x360_register_notification(m_client, m_pad, &RumbleCallback, (void*)(&m_rumbleContext));

    m_thread = std::thread(&VirtualPad::inputPollLoop, this);

    printf("Connected a controller!\n");

    return m_rumbleContext.deferred.Promise();


}

Napi::Value VirtualPad::sendInput(const Napi::CallbackInfo &info)
{

    Napi::Env env = info.Env();
    if (info.Length() < 2) 
    {
        throwError(env, "Incorrect number of arguments");
        return env.Null();
    }
    if (!info[0].IsNumber()) 
    {
        throwError(env, "Invalid first argument");
        return env.Null();
    }
    if (!info[1].IsBoolean()) 
    {
        throwError(env, "Invalid second argument");
        return env.Null();
    }

    ControllerInput currentInput;

    USHORT buttonMask = info[0].As<Napi::Number>().Uint32Value();
    printf("ButtonMask: %d", buttonMask);
    
    bool pressed = info[1].As<Napi::Boolean>();
    const char* pressedLog = pressed? "Pressed: true" : "Pressed:False";
    printf(pressedLog);

    currentInput.buttonMask = buttonMask;
    currentInput.pressState = pressed;

    injectInput(currentInput);

    return Napi::Value();
}

Napi::Value VirtualPad::endController(const Napi::CallbackInfo &info)
{
    Napi::Env env = info.Env();

    g_padActive = false;

    if (m_thread.joinable()) {
        m_thread.join();
    }


    m_rumbleContext.tsfn.Release();


    vigem_target_x360_unregister_notification(m_pad);
    vigem_target_remove(m_client, m_pad);
    vigem_target_free(m_pad);
    vigem_disconnect(m_client);
    vigem_free(m_client);

    printf("Cleaning shutdown complete");

    return Napi::Value();
}


std::atomic<bool>& VirtualPad::getPadActive()
{
    return g_padActive;
}

std::thread &VirtualPad::getPadThread()
{
    return m_thread;
    // TODO: insert return statement here
}

void VirtualPad::injectInput(ControllerInput input)
{
    
    std::lock_guard<std::mutex> lock(g_mutex);
    g_controllerInputQueue.push(input);
    printf("Detected Input %d", input.buttonMask);
    
}

void VirtualPad::inputPollLoop()
{
    XUSB_REPORT report;
    
    while (g_padActive) {
        RtlZeroMemory(&report, sizeof(DS4_REPORT));
        
        {
            std::lock_guard<std::mutex> lock(g_mutex);
            while (!g_controllerInputQueue.empty()) 
            {
                ControllerInput input = g_controllerInputQueue.front();
                g_controllerInputQueue.pop();
                
                if (input.pressState) 
                {
                    g_buttonStates |= input.buttonMask;
                } 
                else 
                {
                    g_buttonStates &= ~input.buttonMask;
                }
                
            }
        }

        report.wButtons = g_buttonStates;
        vigem_target_x360_update(m_client, m_pad, report);
        
        
        std::this_thread::sleep_for(std::chrono::milliseconds(15));
        
    }

    
}

void VirtualPad::startControllerRumbleContext(Napi::Env &env)
{




}

void throwError(Napi::Env& env, const char *message)
{
    Napi::TypeError::New(env, message).ThrowAsJavaScriptException();
    
}

void TestThreaded(std::atomic<bool>& active)
{
    if (active) {
        return;
    }
    active = true;
    
    for (uint32_t i = 0; i < 10000; i++) {
        printf("And that is %d", i);
        
        std::this_thread::sleep_for(std::chrono::seconds(1)); 
    }
    
}

void testEnvs(Napi::Env env)
{

    napi_value global, add_two, arg;
    napi_status status = napi_get_global(env, &global);
    if (status != napi_ok) return;
   
    status = napi_get_named_property(env, global, "AddTwo", &add_two);
    if (status != napi_ok) return;
    
    // const arg = 1337
    status = napi_create_int32(env, 1337, &arg);
    if (status != napi_ok) return;

    napi_value* argv = &arg;
    size_t argc = 1;

    napi_value return_val;
    status = napi_call_function(env, global, add_two, argc, argv, &return_val);
    if (status != napi_ok) return;

    Napi::Function func = Napi::Value(env, return_val).As<Napi::Function>();

    func.Call({});


    // if (info.Length() < 1 || !info[0].IsFunction()) {
    //     throwError(env, "Wrong Parameters");
    //     return env.Null();
    // }

   
    

}

void finalizeCallBack(Napi::Env env, void *finalizeData, RumbleContext *context)
{

    context->deferred.Resolve(Napi::String::New(env, "Closed rumble context successfully"));

}

Napi::Function VirtualPad::GetClass(Napi::Env env)
{
    return DefineClass(
        env,
        "VirtualPad",
        {
            VirtualPad::InstanceMethod("test", &VirtualPad::test),
            VirtualPad::InstanceMethod("startController", &VirtualPad::startController),
            VirtualPad::InstanceMethod("sendInput", &VirtualPad::sendInput),
            VirtualPad::InstanceMethod("endController", &VirtualPad::endController)

            

        }
    );

}

Napi::Object Init(Napi::Env env, Napi::Object exports) {
    Napi::String name = Napi::String::New(env, "VirtualPad");
    exports.Set(name, VirtualPad::GetClass(env));
    return exports;
}

NODE_API_MODULE(addon, Init);
